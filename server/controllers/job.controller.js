const crypto = require("crypto");
const pool = require("../config/database");
const jobQueue = require("../queues/job.queue");
const deadLetterQueue = require("../queues/dead-letter.queue");
const { AppError } = require("../utils/errors");
const { parseId, normalizePositiveInteger } = require("../domain/jobs");
const { reserveUserJob, newBullmqId } = require("../services/job.service");
const { dispatchJobById, syncScheduleById } = require("../services/outbox.service");
const { listJobTypes } = require("../../worker/handlers");

const getJobTypes = async (req, res) => res.json(listJobTypes());

async function createReservedJob(req, res, delayed) {
    const job = await reserveUserJob(req.user.userId, { ...req.validatedBody, delay: delayed ? req.validatedBody.delay : 0 });
    const enqueued = await dispatchJobById(job.id);

    res.status(enqueued ? 201 : 202).json({
        message: enqueued ? (delayed ? "Delayed job scheduled successfully" : "Job added successfully") : "Job accepted and awaiting queue delivery",
        jobId: job.bullmq_job_id, databaseJobId: job.id, projectId: job.project_id,
        status: enqueued ? (delayed ? "DELAYED" : "QUEUED") : "PENDING",
        priority: job.priority, ...(delayed ? { delay: job.delay_ms } : {})
    });
}

const createJob = (req, res) => createReservedJob(req, res, false);
const createDelayedJob = (req, res) => createReservedJob(req, res, true);

const getJob = async (req, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query(
        `SELECT jobs.* FROM jobs JOIN projects ON projects.id = jobs.project_id
         WHERE jobs.id = $1 AND projects.user_id = $2`, [id, req.user.userId]
    );
    if (result.rowCount === 0) throw new AppError(404, "Job not found", "NOT_FOUND");
    const attempts = await pool.query("SELECT * FROM job_attempts WHERE job_id = $1 ORDER BY attempt_number ASC", [id]);
    res.json({ job: result.rows[0], attempts: attempts.rows });
};

const getAllJobs = async (req, res) => {
    const projectId = req.query.projectId ? parseId(req.query.projectId, "projectId") : null;
    const limit = req.query.limit ? normalizePositiveInteger(req.query.limit, "limit", { min: 1, max: 200 }) : 100;
    const offset = req.query.offset ? normalizePositiveInteger(req.query.offset, "offset", { min: 0, max: 1000000 }) : 0;
    const result = await pool.query(
        `SELECT jobs.* FROM jobs JOIN projects ON projects.id = jobs.project_id
         WHERE projects.user_id = $1 AND ($2::bigint IS NULL OR jobs.project_id = $2)
         ORDER BY jobs.created_at DESC LIMIT $3 OFFSET $4`, [req.user.userId, projectId, limit, offset]
    );
    res.json(result.rows);
};

const getFailedJobs = async (req, res) => {
    const result = await pool.query(
        `SELECT d.dlq_id, d.job_id, d.original_bullmq_job_id, d.error, d.status, d.created_at,
                j.type, j.data, j.project_id, j.attempts, j.updated_at AS last_failure_at
         FROM dead_letter_entries d JOIN jobs j ON j.id = d.job_id JOIN projects p ON p.id = d.project_id
         WHERE p.user_id = $1 AND d.status = 'OPEN' ORDER BY d.created_at DESC LIMIT 100`,
        [req.user.userId]
    );
    res.json(result.rows);
};

const retryFailedJob = async (req, res) => {
    const dlqId = req.params.dlqId;
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(dlqId)) throw new AppError(400, "Invalid DLQ identifier", "VALIDATION_ERROR");
    const client = await pool.connect();
    let job;
    try {
        await client.query("BEGIN");
        const entryResult = await client.query(
            `SELECT d.id, d.job_id FROM dead_letter_entries d JOIN projects p ON p.id = d.project_id
             WHERE d.dlq_id = $1 AND d.status = 'OPEN' AND p.user_id = $2 FOR UPDATE`,
            [dlqId, req.user.userId]
        );
        if (entryResult.rowCount === 0) throw new AppError(404, "Failed job not found", "NOT_FOUND");
        const newJobId = newBullmqId("retry");
        const updated = await client.query(
            `UPDATE jobs SET bullmq_job_id = $1, status = 'PENDING', error = NULL,
                result = NULL, started_at = NULL, completed_at = NULL, enqueue_status = 'PENDING',
                enqueue_attempts = 0, enqueue_error = NULL, next_enqueue_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = 'FAILED' RETURNING *`,
            [newJobId, entryResult.rows[0].job_id]
        );
        if (updated.rowCount === 0) throw new AppError(409, "Job is not in a retryable state", "NOT_RETRYABLE");
        job = updated.rows[0];
        await client.query(
            `UPDATE dead_letter_entries SET status = 'RETRIED', retry_bullmq_job_id = $1,
                enqueue_status = 'CANCELLED', retried_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [newJobId, entryResult.rows[0].id]
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }

    const dlqJob = await deadLetterQueue.getJob(`dlq-${dlqId}`);
    if (dlqJob) await dlqJob.remove().catch(() => undefined);
    const enqueued = await dispatchJobById(job.id);
    res.status(202).json({
        message: enqueued ? "Failed job queued again" : "Retry accepted and awaiting queue delivery",
        dlqId, jobId: job.bullmq_job_id, databaseJobId: job.id
    });
};

const cancelJob = async (req, res) => {
    const bullmqId = req.params.id;
    if (!bullmqId || bullmqId.length > 100) throw new AppError(400, "Invalid job identifier", "VALIDATION_ERROR");
    const result = await pool.query(
        `SELECT j.id, j.status FROM jobs j JOIN projects p ON p.id = j.project_id
         WHERE j.bullmq_job_id = $1 AND p.user_id = $2`, [bullmqId, req.user.userId]
    );
    if (result.rowCount === 0) throw new AppError(404, "Job not found", "NOT_FOUND");
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(result.rows[0].status)) {
        throw new AppError(409, "Job is already in a terminal state", "NOT_CANCELLABLE");
    }
    const queueJob = await jobQueue.getJob(bullmqId);
    if (queueJob) {
        const state = await queueJob.getState();
        if (state === "active") throw new AppError(409, "An active job cannot be cancelled", "JOB_ACTIVE");
        await queueJob.remove();
    }
    const updated = await pool.query(
        `UPDATE jobs SET status = 'CANCELLED', enqueue_status = 'CANCELLED', completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status NOT IN ('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')`,
        [result.rows[0].id]
    );
    if (updated.rowCount === 0) throw new AppError(409, "Job became active and cannot be cancelled", "JOB_ACTIVE");
    res.json({ message: "Job cancelled successfully", jobId: bullmqId });
};

const createRecurringJob = async (req, res) => {
    const value = req.validatedBody;
    const scheduleId = crypto.randomUUID();
    const schedulerId = `schedule-${scheduleId}`;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const project = await client.query("SELECT id FROM projects WHERE id = $1 AND user_id = $2 FOR SHARE", [value.projectId, req.user.userId]);
        if (project.rowCount === 0) throw new AppError(404, "Project not found", "NOT_FOUND");
        await client.query(
            `INSERT INTO recurring_schedules
                (schedule_id, scheduler_id, project_id, type, data, every_ms, priority, max_attempts, sync_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')`,
            [scheduleId, schedulerId, value.projectId, value.type, value.data, value.everyMs, value.priority, value.maxAttempts]
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
    const synced = await syncScheduleById(scheduleId);
    res.status(synced ? 201 : 202).json({
        message: synced ? "Recurring schedule created" : "Schedule accepted and awaiting Redis synchronization",
        scheduleId, projectId: value.projectId, status: synced ? "ACTIVE" : "PENDING"
    });
};

const listRecurringJobs = async (req, res) => {
    const projectId = req.query.projectId ? parseId(req.query.projectId, "projectId") : null;
    const result = await pool.query(
        `SELECT s.schedule_id, s.project_id, s.type, s.data, s.every_ms, s.priority, s.max_attempts,
                s.status, s.sync_status, s.sync_error, s.created_at, s.updated_at
         FROM recurring_schedules s JOIN projects p ON p.id = s.project_id
         WHERE p.user_id = $1 AND ($2::bigint IS NULL OR s.project_id = $2)
         ORDER BY s.created_at DESC`, [req.user.userId, projectId]
    );
    res.json(result.rows);
};

const updateRecurringJob = async (req, res) => {
    const value = req.validatedBody;
    const result = await pool.query(
        `UPDATE recurring_schedules s SET type = COALESCE($3, s.type), data = COALESCE($4, s.data),
            every_ms = COALESCE($5, s.every_ms), priority = COALESCE($6, s.priority),
            max_attempts = COALESCE($7, s.max_attempts), sync_status = 'PENDING', sync_error = NULL,
            updated_at = CURRENT_TIMESTAMP FROM projects p
         WHERE p.id = s.project_id AND s.schedule_id = $1 AND p.user_id = $2 RETURNING s.schedule_id`,
        [req.params.scheduleId, req.user.userId, value.type ?? null, value.data ?? null, value.everyMs ?? null, value.priority ?? null, value.maxAttempts ?? null]
    );
    if (result.rowCount === 0) throw new AppError(404, "Schedule not found", "NOT_FOUND");
    const synced = await syncScheduleById(req.params.scheduleId);
    res.status(synced ? 200 : 202).json({ message: synced ? "Schedule updated" : "Schedule update is awaiting Redis synchronization", scheduleId: req.params.scheduleId });
};

const deleteRecurringJob = async (req, res) => {
    const result = await pool.query(
        `UPDATE recurring_schedules s SET status = 'DELETING', sync_status = 'PENDING', updated_at = CURRENT_TIMESTAMP
         FROM projects p WHERE p.id = s.project_id AND s.schedule_id = $1 AND p.user_id = $2 RETURNING s.schedule_id`,
        [req.params.scheduleId, req.user.userId]
    );
    if (result.rowCount === 0) throw new AppError(404, "Schedule not found", "NOT_FOUND");
    const synced = await syncScheduleById(req.params.scheduleId);
    res.status(synced ? 200 : 202).json({ message: synced ? "Schedule deleted" : "Schedule deletion is awaiting Redis synchronization" });
};

const pauseQueue = async (req, res) => { await jobQueue.pause(); res.json({ message: "Queue paused successfully" }); };
const resumeQueue = async (req, res) => { await jobQueue.resume(); res.json({ message: "Queue resumed successfully" }); };

module.exports = {
    getJobTypes, createJob, createDelayedJob, getJob, getAllJobs, getFailedJobs, retryFailedJob, cancelJob,
    createRecurringJob, listRecurringJobs, updateRecurringJob, deleteRecurringJob, pauseQueue, resumeQueue
};
