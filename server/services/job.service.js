const crypto = require("crypto");
const pool = require("../config/database");
const { AppError } = require("../utils/errors");

function newBullmqId(prefix = "job") {
    return `${prefix}-${crypto.randomUUID()}`;
}

async function reserveUserJob(userId, input) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const project = await client.query(
            "SELECT id FROM projects WHERE id = $1 AND user_id = $2 FOR SHARE",
            [input.projectId, userId]
        );
        if (project.rowCount === 0) throw new AppError(404, "Project not found", "NOT_FOUND");
        const result = await client.query(
            `INSERT INTO jobs
                (bullmq_job_id, project_id, type, data, status, priority, max_attempts, delay_ms, enqueue_status)
             VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, 'PENDING') RETURNING *`,
            [newBullmqId(), input.projectId, input.type, input.data, input.priority, input.maxAttempts || 3, input.delay || 0]
        );
        await client.query("COMMIT");
        return result.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
}

async function reserveApiJob(projectId, input, idempotencyKey) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM projects WHERE id = $1 FOR SHARE", [projectId]);
        const result = await client.query(
            `INSERT INTO jobs
                (bullmq_job_id, project_id, type, data, status, priority, max_attempts, idempotency_key, enqueue_status)
             VALUES ($1, $2, $3, $4, 'PENDING', $5, 3, $6, 'PENDING')
             ON CONFLICT (project_id, idempotency_key) DO NOTHING RETURNING *`,
            [newBullmqId(`job-${projectId}`), projectId, input.type, input.data, input.priority, idempotencyKey]
        );
        let job = result.rows[0];
        let created = true;
        if (!job) {
            created = false;
            const existing = await client.query(
                "SELECT * FROM jobs WHERE project_id = $1 AND idempotency_key = $2",
                [projectId, idempotencyKey]
            );
            job = existing.rows[0];
        }
        await client.query("COMMIT");
        return { job, created };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
}

module.exports = { newBullmqId, reserveUserJob, reserveApiJob };
