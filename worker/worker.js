const crypto = require("crypto");
const { Worker } = require("bullmq");
const config = require("../server/config/env");
const { worker: connection } = require("../server/config/redis");
const pool = require("../server/config/database");
const jobQueue = require("../server/queues/job.queue");
const deadLetterQueue = require("../server/queues/dead-letter.queue");
const { publisher } = require("../server/config/pubsub");
const { ensurePublisher, publishJobEvent } = require("../server/services/event.service");
const { dispatchDlqEntry } = require("../server/services/outbox.service");
const logger = require("../server/utils/logger");
const { getHandler, listHandlers } = require("./handlers");

async function resolveDatabaseJob(job) {
    if (job.data?.databaseJobId) {
        const result = await pool.query(
            `SELECT j.id, j.project_id, p.user_id FROM jobs j JOIN projects p ON p.id = j.project_id
             WHERE j.id = $1 AND j.bullmq_job_id = $2`,
            [job.data.databaseJobId, job.id]
        );
        if (result.rowCount === 0) throw new Error(`Persisted job ${job.data.databaseJobId} was not found`);
        return result.rows[0];
    }

    if (!job.data?.scheduleId) throw new Error(`Job ${job.id} is missing its persisted identity`);
    const schedule = await pool.query(
        `SELECT s.project_id, p.user_id, s.priority, s.max_attempts
         FROM recurring_schedules s JOIN projects p ON p.id = s.project_id
         WHERE s.schedule_id = $1 AND s.status = 'ACTIVE'`,
        [job.data.scheduleId]
    );
    if (schedule.rowCount === 0) throw new Error(`Recurring schedule ${job.data.scheduleId} was not found`);
    const value = schedule.rows[0];
    const inserted = await pool.query(
        `INSERT INTO jobs
            (bullmq_job_id, project_id, type, data, status, priority, max_attempts, enqueue_status)
         VALUES ($1, $2, $3, $4, 'QUEUED', $5, $6, 'ENQUEUED')
         ON CONFLICT (bullmq_job_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id, project_id`,
        [job.id, value.project_id, job.name, job.data.payload || {}, value.priority, value.max_attempts]
    );
    return { ...inserted.rows[0], user_id: value.user_id };
}

async function startAttempt(databaseJobId) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const nextAttempt = await client.query(
            "SELECT COALESCE(MAX(attempt_number), 0) + 1 AS attempt_number FROM job_attempts WHERE job_id = $1",
            [databaseJobId]
        );
        const attemptNumber = Number(nextAttempt.rows[0].attempt_number);
        const attempt = await client.query(
            `INSERT INTO job_attempts (job_id, attempt_number, status, started_at)
             VALUES ($1, $2, 'PROCESSING', CURRENT_TIMESTAMP)
             ON CONFLICT (job_id, attempt_number) DO UPDATE
             SET status = 'PROCESSING', error = NULL, result = NULL, started_at = CURRENT_TIMESTAMP, completed_at = NULL
             RETURNING id`,
            [databaseJobId, attemptNumber]
        );
        await client.query(
            `UPDATE jobs SET status = 'PROCESSING', started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                attempts = $2, error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [databaseJobId, attemptNumber]
        );
        await client.query("COMMIT");
        return { attemptId: attempt.rows[0].id, attemptNumber };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
}

async function finishAttempt(databaseJobId, attemptId, result) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE job_attempts SET status = 'COMPLETED', result = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [attemptId, result]
        );
        await client.query(
            `UPDATE jobs SET status = 'COMPLETED', result = $2, error = NULL,
                completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [databaseJobId, result]
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
}

async function failAttempt({ databaseJobId, projectId, bullmqJobId, attemptId, attemptNumber, currentAttempt, maxAttempts, error }) {
    const finalFailure = currentAttempt >= maxAttempts;
    const safeError = String(error.message || error).slice(0, 4000);
    const client = await pool.connect();
    let dlqId = null;
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE job_attempts SET status = 'FAILED', error = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [attemptId, safeError]
        );
        await client.query(
            `UPDATE jobs SET status = $2, attempts = $3, error = $4,
                completed_at = CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [databaseJobId, finalFailure ? "FAILED" : "RETRYING", attemptNumber, safeError, finalFailure]
        );
        if (finalFailure) {
            dlqId = crypto.randomUUID();
            const inserted = await client.query(
                `INSERT INTO dead_letter_entries
                    (dlq_id, job_id, project_id, original_bullmq_job_id, error, status, enqueue_status)
                 VALUES ($1, $2, $3, $4, $5, 'OPEN', 'PENDING')
                 ON CONFLICT (job_id) WHERE status = 'OPEN' DO UPDATE SET error = EXCLUDED.error
                 RETURNING dlq_id`,
                [dlqId, databaseJobId, projectId, bullmqJobId, safeError]
            );
            dlqId = inserted.rows[0].dlq_id;
        }
        await client.query("COMMIT");
    } catch (databaseError) {
        await client.query("ROLLBACK");
        throw databaseError;
    } finally { client.release(); }
    return { finalFailure, dlqId, safeError };
}

async function processJob(job) {
    const databaseJob = await resolveDatabaseJob(job);
    const currentAttempt = job.attemptsMade + 1;
    const maxAttempts = Number(job.opts.attempts || 1);
    const { attemptId, attemptNumber } = await startAttempt(databaseJob.id);

    await publishJobEvent({
        event: "JOB_PROCESSING", jobId: job.id, databaseJobId: databaseJob.id,
        type: job.name, status: "PROCESSING", attempt: attemptNumber, userId: databaseJob.user_id
    });

    try {
        const handler = getHandler(job.name);
        const result = await handler(job.data?.payload || {}, {
            attemptNumber, currentAttempt, maxAttempts, jobId: job.id, databaseJobId: databaseJob.id
        });
        await finishAttempt(databaseJob.id, attemptId, result ?? null);
        await publishJobEvent({
            event: "JOB_COMPLETED", jobId: job.id, databaseJobId: databaseJob.id,
            type: job.name, status: "COMPLETED", attempt: attemptNumber, userId: databaseJob.user_id
        });
        return result;
    } catch (error) {
        const failure = await failAttempt({
            databaseJobId: databaseJob.id, projectId: databaseJob.project_id,
            bullmqJobId: job.id, attemptId, attemptNumber, currentAttempt, maxAttempts, error
        });
        await publishJobEvent({
            event: failure.finalFailure ? "JOB_FAILED" : "JOB_RETRYING",
            jobId: job.id, databaseJobId: databaseJob.id, type: job.name,
            status: failure.finalFailure ? "FAILED" : "RETRYING", attempt: attemptNumber,
            error: failure.safeError, userId: databaseJob.user_id, dlqId: failure.dlqId
        });
        if (failure.dlqId) await dispatchDlqEntry(failure.dlqId);
        throw error;
    }
}

let worker;
let shuttingDown = false;

async function startWorker() {
    await ensurePublisher();
    worker = new Worker("aetheris-jobs", processJob, { connection, concurrency: config.workerConcurrency });
    worker.on("completed", (job) => logger.info("Job completed", { jobId: job.id, type: job.name }));
    worker.on("failed", (job, error) => logger.warn("Job attempt failed", { jobId: job?.id, type: job?.name, error: error.message }));
    worker.on("stalled", (jobId) => logger.warn("Job stalled", { jobId }));
    worker.on("error", (error) => logger.error("Worker error", { error: error.message }));
    logger.info("Aetheris worker started", { concurrency: config.workerConcurrency, handlers: listHandlers() });
}

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Worker shutdown started", { signal });
    const timeout = setTimeout(() => process.exit(1), 30000);
    timeout.unref();
    try {
        if (worker) await worker.close();
        await Promise.allSettled([jobQueue.close(), deadLetterQueue.close()]);
        if (publisher.isOpen) await publisher.quit();
        await pool.end();
        clearTimeout(timeout);
        logger.info("Worker shutdown complete");
        process.exit(0);
    } catch (error) {
        logger.error("Worker shutdown failed", { error: error.message });
        process.exit(1);
    }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (require.main === module) {
    startWorker().catch((error) => {
        logger.error("Worker startup failed", { error: error.message });
        process.exitCode = 1;
    });
}

module.exports = { startWorker, processJob, resolveDatabaseJob };
