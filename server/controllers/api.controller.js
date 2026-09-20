const { reserveApiJob } = require("../services/job.service");
const { dispatchJobById } = require("../services/outbox.service");

const createApiJob = async (req, res) => {
    const reservation = await reserveApiJob(req.project.id, req.validatedBody, req.idempotencyKey);
    if (!reservation.created) {
        return res.status(200).json({
            message: "Job already exists", jobId: reservation.job.bullmq_job_id,
            databaseJobId: reservation.job.id, projectId: reservation.job.project_id,
            status: reservation.job.status
        });
    }
    const enqueued = await dispatchJobById(reservation.job.id);
    res.status(enqueued ? 201 : 202).json({
        message: enqueued ? "Job submitted successfully" : "Job accepted and awaiting queue delivery",
        jobId: reservation.job.bullmq_job_id, databaseJobId: reservation.job.id,
        projectId: reservation.job.project_id, status: enqueued ? "QUEUED" : "PENDING"
    });
};

module.exports = { createApiJob };
