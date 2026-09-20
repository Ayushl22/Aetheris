const pool = require("../config/database");
const config = require("../config/env");
const jobQueue = require("../queues/job.queue");
const deadLetterQueue = require("../queues/dead-letter.queue");
const logger = require("../utils/logger");

function retentionOptions() {
    return {
        removeOnComplete: { age: config.retention.completeAge, count: config.retention.completeCount },
        removeOnFail: { age: config.retention.failAge, count: config.retention.failCount }
    };
}

async function markEnqueueFailure(jobId, error) {
    await pool.query(
        `UPDATE jobs
         SET enqueue_status = 'FAILED', enqueue_attempts = enqueue_attempts + 1,
             enqueue_error = $2, next_enqueue_at = CURRENT_TIMESTAMP +
                make_interval(secs => LEAST(60, POWER(2, LEAST(enqueue_attempts, 5))::int)),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND enqueue_status <> 'CANCELLED'`,
        [jobId, String(error.message || error).slice(0, 1000)]
    );
}

async function dispatchJobById(jobId) {
    const result = await pool.query(
        `SELECT id, bullmq_job_id, project_id, type, data, priority, max_attempts, delay_ms, status, enqueue_status
         FROM jobs WHERE id = $1`,
        [jobId]
    );
    if (result.rowCount === 0) return false;
    const job = result.rows[0];
    if (job.enqueue_status === "CANCELLED" || job.status === "CANCELLED") return false;

    try {
        await jobQueue.add(job.type, {
            databaseJobId: job.id,
            projectId: job.project_id,
            payload: job.data
        }, {
            jobId: job.bullmq_job_id,
            priority: job.priority,
            attempts: job.max_attempts,
            delay: job.delay_ms,
            backoff: { type: "exponential", delay: 2000 },
            ...retentionOptions()
        });
        await pool.query(
            `UPDATE jobs SET enqueue_status = 'ENQUEUED', enqueue_error = NULL,
                status = CASE
                    WHEN status = 'PENDING' AND delay_ms > 0 THEN 'DELAYED'
                    WHEN status = 'PENDING' THEN 'QUEUED'
                    ELSE status
                END,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status <> 'CANCELLED'`,
            [job.id]
        );
        return true;
    } catch (error) {
        await markEnqueueFailure(job.id, error);
        logger.warn("Job enqueue deferred", { databaseJobId: job.id, error: error.message });
        return false;
    }
}

async function dispatchPendingJobs(limit = 50) {
    const result = await pool.query(
        `SELECT id FROM jobs
         WHERE enqueue_status IN ('PENDING', 'FAILED') AND next_enqueue_at <= CURRENT_TIMESTAMP
           AND status NOT IN ('CANCELLED', 'COMPLETED', 'FAILED')
         ORDER BY next_enqueue_at, id LIMIT $1`,
        [limit]
    );
    for (const row of result.rows) await dispatchJobById(row.id);
    return result.rowCount;
}

async function dispatchDlqEntry(dlqId) {
    const result = await pool.query(
        `SELECT d.id, d.dlq_id, d.job_id, d.project_id, d.original_bullmq_job_id, d.error,
                j.type, j.data
         FROM dead_letter_entries d JOIN jobs j ON j.id = d.job_id
         WHERE d.dlq_id = $1 AND d.status = 'OPEN'`,
        [dlqId]
    );
    if (result.rowCount === 0) return false;
    const entry = result.rows[0];
    try {
        await deadLetterQueue.add("FAILED_JOB", {
            dlqId: entry.dlq_id,
            databaseJobId: entry.job_id,
            projectId: entry.project_id,
            originalJobId: entry.original_bullmq_job_id,
            originalJobName: entry.type,
            originalJobData: entry.data,
            error: entry.error
        }, { jobId: `dlq-${entry.dlq_id}`, ...retentionOptions() });
        await pool.query(
            "UPDATE dead_letter_entries SET enqueue_status = 'ENQUEUED', enqueue_error = NULL WHERE id = $1",
            [entry.id]
        );
        return true;
    } catch (error) {
        await pool.query(
            `UPDATE dead_letter_entries SET enqueue_status = 'FAILED', enqueue_attempts = enqueue_attempts + 1,
                enqueue_error = $2, next_enqueue_at = CURRENT_TIMESTAMP + INTERVAL '10 seconds' WHERE id = $1`,
            [entry.id, String(error.message || error).slice(0, 1000)]
        );
        return false;
    }
}

async function dispatchPendingDlq(limit = 50) {
    const result = await pool.query(
        `SELECT dlq_id FROM dead_letter_entries
         WHERE status = 'OPEN' AND enqueue_status IN ('PENDING', 'FAILED')
           AND next_enqueue_at <= CURRENT_TIMESTAMP ORDER BY id LIMIT $1`,
        [limit]
    );
    for (const row of result.rows) await dispatchDlqEntry(row.dlq_id);
}

async function syncScheduleById(scheduleId) {
    const result = await pool.query(
        `SELECT schedule_id, scheduler_id, project_id, type, data, every_ms, priority, max_attempts, status
         FROM recurring_schedules WHERE schedule_id = $1`,
        [scheduleId]
    );
    if (result.rowCount === 0) return false;
    const schedule = result.rows[0];
    try {
        if (schedule.status === "DELETING") {
            await jobQueue.removeJobScheduler(schedule.scheduler_id);
            await pool.query("DELETE FROM recurring_schedules WHERE schedule_id = $1", [scheduleId]);
            return true;
        }
        await jobQueue.upsertJobScheduler(
            schedule.scheduler_id,
            { every: schedule.every_ms },
            {
                name: schedule.type,
                data: { scheduleId: schedule.schedule_id, projectId: schedule.project_id, payload: schedule.data },
                opts: {
                    priority: schedule.priority,
                    attempts: schedule.max_attempts,
                    backoff: { type: "exponential", delay: 2000 },
                    ...retentionOptions()
                }
            }
        );
        await pool.query(
            "UPDATE recurring_schedules SET sync_status = 'SYNCED', sync_error = NULL, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE schedule_id = $1",
            [scheduleId]
        );
        return true;
    } catch (error) {
        await pool.query(
            "UPDATE recurring_schedules SET sync_status = 'FAILED', sync_error = $2, updated_at = CURRENT_TIMESTAMP WHERE schedule_id = $1",
            [scheduleId, String(error.message || error).slice(0, 1000)]
        );
        return false;
    }
}

async function syncPendingSchedules(limit = 50) {
    const result = await pool.query(
        "SELECT schedule_id FROM recurring_schedules WHERE sync_status IN ('PENDING', 'FAILED') ORDER BY updated_at, id LIMIT $1",
        [limit]
    );
    for (const row of result.rows) await syncScheduleById(row.schedule_id);
}

function startOutboxDispatcher() {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            await dispatchPendingJobs();
            await dispatchPendingDlq();
            await syncPendingSchedules();
        } catch (error) {
            logger.error("Outbox dispatcher iteration failed", { error: error.message });
        } finally {
            running = false;
        }
    };
    const timer = setInterval(run, config.outboxPollIntervalMs);
    timer.unref();
    run();
    return () => clearInterval(timer);
}

module.exports = {
    retentionOptions,
    dispatchJobById,
    dispatchPendingJobs,
    dispatchDlqEntry,
    dispatchPendingDlq,
    syncScheduleById,
    syncPendingSchedules,
    startOutboxDispatcher
};
