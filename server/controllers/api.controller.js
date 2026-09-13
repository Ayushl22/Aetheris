const crypto = require("crypto");
const jobQueue = require("../queues/job.queue");
const pool = require("../config/database");

const priorities = {
    HIGH: 1,
    MEDIUM: 5,
    LOW: 10
};

const createApiJob = async (req, res) => {
    try {
        const { type, data, priority } = req.body;
        const idempotencyKey = req.headers["idempotency-key"];

        if (!type) {
            return res.status(400).json({
                message: "Job type is required"
            });
        }

        if (!idempotencyKey) {
            return res.status(400).json({
                message: "Idempotency-Key header is required"
            });
        }

        const jobIdHash = crypto
            .createHash("sha256")
            .update(`${req.project.id}:${idempotencyKey}`)
            .digest("hex");

        const jobId = `${req.project.id}-${jobIdHash}`;

        const reservation = await pool.query(
    `INSERT INTO jobs
    (bullmq_job_id, project_id, type, data, status, priority, idempotency_key)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (project_id, idempotency_key)
    DO NOTHING
    RETURNING id`,
    [
        jobId,
        req.project.id,
        type,
        data,
        "QUEUED",
        priorities[priority] || 5,
        idempotencyKey
    ]
);

if (reservation.rows.length === 0) {
    const existingJob = await pool.query(
        `SELECT bullmq_job_id, project_id, status
         FROM jobs
         WHERE project_id = $1
         AND idempotency_key = $2`,
        [req.project.id, idempotencyKey]
    );

    return res.status(200).json({
        message: "Job already exists",
        jobId: existingJob.rows[0].bullmq_job_id,
        projectId: existingJob.rows[0].project_id,
        status: existingJob.rows[0].status
    });
}


let job;

try {
    job = await jobQueue.add(type, data, {
        jobId: jobId,
        priority: priorities[priority] || 5,
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000
        }
    });
} catch (error) {
    await pool.query(
        `DELETE FROM jobs
         WHERE project_id = $1
         AND idempotency_key = $2`,
        [req.project.id, idempotencyKey]
    );

    throw error;
}


        res.status(201).json({
            message: "Job submitted successfully",
            jobId: job.id,
            projectId: req.project.id
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to submit job"
        });
    }
};

module.exports = {
    createApiJob
};