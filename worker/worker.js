require("dotenv").config({ path: "../.env" });

const { Worker } = require("bullmq");

const deadLetterQueue = require("../server/queues/dead-letter.queue");
const pool = require("../server/config/database");
const { publisher } = require("../server/config/pubsub");

publisher.connect();

const connection = require("../server/config/redis.js");

const worker = new Worker(
    "aetheris-jobs",

    async (job) => {
        console.log("Job received:", job.id);
        console.log("Repeat job key:", job.repeatJobKey);
        console.log("Job type:", job.name);
        console.log("Job data:", job.data);
        console.log("Processing job...");

        // Find the corresponding job in PostgreSQL
        let result = await pool.query(
            `SELECT id
             FROM jobs
             WHERE bullmq_job_id = $1`,
            [job.id]
        );

        let databaseJobId;

        if (result.rows.length === 0) {

            const schedulerId = job.repeatJobKey
                ? job.repeatJobKey.split(":")[0]
                : null;

            if (!schedulerId) {
                throw new Error(`Job ${job.id} not found in database`);
            }

            const schedulerResult = await pool.query(
                `SELECT id, project_id
                 FROM recurring_schedules
                 WHERE scheduler_id = $1`,
                [schedulerId]
            );

            if (schedulerResult.rows.length === 0) {
                throw new Error(
                    `Recurring scheduler ${schedulerId} not found in database`
                );
            }

            const scheduler = schedulerResult.rows[0];

            const insertResult = await pool.query(
                `INSERT INTO jobs
                (bullmq_job_id, project_id, type, data, status, priority)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id`,
                [
                    job.id,
                    scheduler.project_id,
                    job.name,
                    job.data,
                    "QUEUED",
                    5
                ]
            );

            databaseJobId = insertResult.rows[0].id;

        } else {
            databaseJobId = result.rows[0].id;
        }

        // Find the user who owns this job
        const ownerResult = await pool.query(
            `SELECT projects.user_id
             FROM jobs
             JOIN projects
             ON jobs.project_id = projects.id
             WHERE jobs.id = $1`,
            [databaseJobId]
        );

        if (ownerResult.rows.length === 0) {
            throw new Error(`Owner not found for job ${job.id}`);
        }

        const userId = ownerResult.rows[0].user_id;

        // Current attempt number
        const attemptNumber = job.attemptsMade + 1;

        // Create execution history record
        const attemptResult = await pool.query(
            `INSERT INTO job_attempts
            (job_id, attempt_number, status, started_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            RETURNING id`,
            [
                databaseJobId,
                attemptNumber,
                "PROCESSING"
            ]
        );

        const attemptId = attemptResult.rows[0].id;

        // Mark job as processing
        await pool.query(
            `UPDATE jobs
             SET status = $1,
                 started_at = CURRENT_TIMESTAMP,
                 attempts = $2
             WHERE id = $3`,
            [
                "PROCESSING",
                attemptNumber,
                databaseJobId
            ]
        );

        await publisher.publish(
            "job-events",
            JSON.stringify({
                event: "JOB_PROCESSING",
                jobId: job.id,
                type: job.name,
                status: "PROCESSING",
                userId: userId
            })
        );

        try {

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Mark this particular attempt as completed
            await pool.query(
                `UPDATE job_attempts
                 SET status = $1,
                     completed_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [
                    "COMPLETED",
                    attemptId
                ]
            );

            // Mark job as completed
            await pool.query(
                `UPDATE jobs
                 SET status = $1,
                     completed_at = CURRENT_TIMESTAMP,
                     attempts = $2
                 WHERE id = $3`,
                [
                    "COMPLETED",
                    attemptNumber,
                    databaseJobId
                ]
            );

            // Publish completion event
            await publisher.publish(
                "job-events",
                JSON.stringify({
                    event: "JOB_COMPLETED",
                    jobId: job.id,
                    type: job.name,
                    status: "COMPLETED",
                    userId: userId
                })
            );

            console.log("Job completed:", job.id);

        } catch (error) {

            // Mark this particular attempt as failed
            await pool.query(
                `UPDATE job_attempts
                 SET status = $1,
                     error = $2,
                     completed_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [
                    "FAILED",
                    error.message,
                    attemptId
                ]
            );
            await publisher.publish(
                "job-events",
                JSON.stringify({
                    event: "JOB_FAILED",
                    jobId: job.id,
                    type: job.name,
                    status: "FAILED",
                    error: error.message,
                    userId: userId
                })
            );

            throw error;

            throw error;
        }
    },

    {
        connection,
        concurrency: 3
    }
);


// BullMQ completed event
worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed successfully`);
});


// BullMQ failed event
worker.on("failed", async (job, err) => {

    console.log(`Job ${job.id} failed:`, err.message);

    await pool.query(
        `UPDATE jobs
         SET status = $1,
             attempts = $2,
             error = $3
         WHERE bullmq_job_id = $4`,
        [
            "FAILED",
            job.attemptsMade,
            err.message,
            job.id
        ]
    );

    // Move job to Dead Letter Queue after 3 attempts
    if (job.attemptsMade >= 3) {

        await deadLetterQueue.add("FAILED_JOB", {
            originalJobId: job.id,
            originalJobName: job.name,
            originalJobData: job.data,
            error: err.message
        });

        console.log(
            `Job ${job.id} moved to Dead Letter Queue`
        );
    }
});


console.log("Aetheris worker started");