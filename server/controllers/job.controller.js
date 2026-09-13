const jobQueue = require("../queues/job.queue");
const deadLetterQueue = require("../queues/dead-letter.queue");
const pool = require("../config/database");

const priorities = {
    HIGH: 1,
    MEDIUM: 5,
    LOW: 10
};

const createJob = async (req, res) => {
    console.log("CREATE JOB ROUTE HIT");

    try {
        const { projectId, type, data, priority } = req.body;

        if (!projectId || !type) {
            return res.status(400).json({
                message: "projectId and type are required"
            });
        }

        // Check whether this project belongs to the logged-in user
        const projectResult = await pool.query(
            `SELECT id
            FROM projects
            WHERE id = $1
            AND user_id = $2`,
            [projectId, req.user.userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(403).json({
                message: "You do not have access to this project"
            });
        }

        const job = await jobQueue.add(type, data, {
            priority: priorities[priority] || 5,
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 2000
            }
        });

        console.log(
            "Created job:",
            job.id,
            "priority:",
            priorities[priority] || 5,
            "project:",
            projectId
        );

        await pool.query(
            `INSERT INTO jobs
            (bullmq_job_id, project_id, type, data, status, priority)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                job.id,
                projectId,
                type,
                data,
                "QUEUED",
                priorities[priority] || 5
            ]
        );

        res.status(201).json({
            message: "Job added successfully",
            jobId: job.id,
            projectId: projectId,
            priority: priority || "MEDIUM"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to add job",
            error: error.message
        });
    }
};


const createDelayedJob = async (req, res) => {
    try {
        const { type, data, delay } = req.body;

        const job = await jobQueue.add(type, data, {
            delay: delay,
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 2000
            }
        });

        await pool.query(
            `INSERT INTO jobs
            (bullmq_job_id, type, data, status)
            VALUES ($1, $2, $3, $4)`,
            [
                job.id,
                type,
                data,
                "QUEUED"
            ]
        );

        res.json({
            message: "Delayed job added successfully",
            jobId: job.id,
            delay: delay
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to add delayed job",
            error: error.message
        });
    }
};



const createRecurringJob = async (req, res) => {
    try {
        const { projectId, type, data, every } = req.body;

        if (!projectId || !type || !every) {
            return res.status(400).json({
                message: "projectId, type and every are required"
            });
        }

        const projectResult = await pool.query(
            `SELECT id
             FROM projects
             WHERE id = $1
             AND user_id = $2`,
            [projectId, req.user.userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const schedulerId = `scheduler-${projectId}-${type}`;

        await jobQueue.upsertJobScheduler(
            schedulerId,
            {
                every: every
            },
            {
                name: type,
                data: data
            }
        );

        await pool.query(
            `INSERT INTO recurring_schedules
            (project_id, scheduler_id, type, data, every, status)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                projectId,
                schedulerId,
                type,
                data,
                every,
                "ACTIVE"
            ]
        );

        res.status(201).json({
            message: "Recurring job scheduled successfully",
            schedulerId: schedulerId,
            projectId: projectId,
            type: type,
            every: every
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to schedule recurring job",
            error: error.message
        });
    }
};

const getJob = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT jobs.*
             FROM jobs
             JOIN projects
             ON jobs.project_id = projects.id
             WHERE jobs.id = $1
             AND projects.user_id = $2`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Job not found"
            });
        }

        const job = result.rows[0];

        const attemptsResult = await pool.query(
            `SELECT *
             FROM job_attempts
             WHERE job_id = $1
             ORDER BY attempt_number ASC`,
            [job.id]
        );

        res.json({
            job: job,
            attempts: attemptsResult.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get job details"
        });
    }
};


const getAllJobs = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT jobs.*
            FROM jobs
            JOIN projects
            ON jobs.project_id = projects.id
            WHERE projects.user_id = $1
            ORDER BY jobs.created_at DESC`,
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get jobs"
        });
    }
};


const getFailedJobs = async (req, res) => {
    try {
        const jobs = await deadLetterQueue.getJobs(
            ["waiting", "active", "completed", "failed"],
            0,
            50
        );

        const failedJobs = jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data
        }));

        res.json(failedJobs);

    } catch (error) {
        res.status(500).json({
            message: "Failed to get failed jobs",
            error: error.message
        });
    }
};


const retryFailedJob = async (req, res) => {
    try {
        const job = await deadLetterQueue.getJob(req.params.id);

        if (!job) {
            return res.status(404).json({
                message: "Failed job not found"
            });
        }

        const newJob = await jobQueue.add(
            job.data.originalJobName,
            job.data.originalJobData,
            {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 2000
                }
            }
        );

        await pool.query(
            `UPDATE jobs
             SET bullmq_job_id = $1,
                 status = $2,
                 attempts = $3,
                 error = $4,
                 started_at = NULL,
                 completed_at = NULL
             WHERE bullmq_job_id = $5`,
            [
                newJob.id,
                "QUEUED",
                0,
                null,
                job.data.originalJobId
            ]
        );

        await job.remove();

        res.json({
            message: "Failed job queued again",
            oldJobId: job.data.originalJobId,
            newJobId: newJob.id
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to retry job",
            error: error.message
        });
    }
};


const cancelJob = async (req, res) => {
    try {
        const job = await jobQueue.getJob(req.params.id);

        if (!job) {
            return res.status(404).json({
                message: "Job not found"
            });
        }

        const state = await job.getState();

        if (state === "active") {
            return res.status(400).json({
                message: "Cannot cancel a job that is already processing"
            });
        }

        await job.remove();

        await pool.query(
            `UPDATE jobs
             SET status = $1
             WHERE bullmq_job_id = $2`,
            [
                "CANCELLED",
                req.params.id
            ]
        );

        res.json({
            message: "Job cancelled successfully",
            jobId: req.params.id
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to cancel job",
            error: error.message
        });
    }
};


const pauseQueue = async (req, res) => {
    try {
        await jobQueue.pause();

        res.json({
            message: "Queue paused successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to pause queue",
            error: error.message
        });
    }
};


const resumeQueue = async (req, res) => {
    try {
        await jobQueue.resume();

        res.json({
            message: "Queue resumed successfully"
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to resume queue",
            error: error.message
        });
    }
};


module.exports = {
    createJob,
    createDelayedJob,
    createRecurringJob,
    getJob,
    getAllJobs,
    getFailedJobs,
    retryFailedJob,
    cancelJob,
    pauseQueue,
    resumeQueue
};