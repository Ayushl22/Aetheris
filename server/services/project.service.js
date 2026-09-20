const pool = require("../config/database");
const jobQueue = require("../queues/job.queue");
const { AppError } = require("../utils/errors");
const { dispatchJobById, syncScheduleById } = require("./outbox.service");

async function deleteProjectSafely(projectId, userId) {
    const client = await pool.connect();
    const removedScheduleIds = [];
    const removedJobIds = [];
    let released = false;
    try {
        await client.query("BEGIN");
        const project = await client.query(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2 FOR UPDATE",
            [projectId, userId]
        );
        if (project.rowCount === 0) throw new AppError(404, "Project not found", "NOT_FOUND");

        const active = await client.query(
            "SELECT 1 FROM jobs WHERE project_id = $1 AND status = 'PROCESSING' LIMIT 1", [projectId]
        );
        if (active.rowCount > 0) throw new AppError(409, "Project has active jobs and cannot be deleted", "ACTIVE_JOBS");

        const schedules = await client.query(
            "SELECT schedule_id, scheduler_id FROM recurring_schedules WHERE project_id = $1",
            [projectId]
        );
        const jobs = await client.query(
            `SELECT id, bullmq_job_id FROM jobs WHERE project_id = $1
             AND status IN ('PENDING', 'QUEUED', 'DELAYED', 'RETRYING')`, [projectId]
        );
        for (const schedule of schedules.rows) {
            await jobQueue.removeJobScheduler(schedule.scheduler_id);
            removedScheduleIds.push(schedule.schedule_id);
        }
        for (const row of jobs.rows) {
            const job = await jobQueue.getJob(row.bullmq_job_id);
            if (!job) continue;
            const state = await job.getState();
            if (state === "active") throw new AppError(409, "Project has active jobs and cannot be deleted", "ACTIVE_JOBS");
            await job.remove();
            removedJobIds.push(row.id);
        }
        await client.query("DELETE FROM projects WHERE id = $1", [projectId]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        released = true;
        // Redis cannot participate in the PostgreSQL transaction. If cleanup
        // was only partly applied, put the still-persisted work back through
        // the same idempotent dispatch paths before surfacing the failure.
        await Promise.allSettled([
            ...removedScheduleIds.map((scheduleId) => syncScheduleById(scheduleId)),
            ...removedJobIds.map(async (jobId) => {
                await pool.query(
                    `UPDATE jobs SET enqueue_status = 'PENDING', next_enqueue_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [jobId]
                );
                return dispatchJobById(jobId);
            })
        ]);
        throw error;
    } finally {
        if (!released) client.release();
    }
}

module.exports = { deleteProjectSafely };
