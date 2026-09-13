const express = require("express");
const authenticate = require("../middleware/auth.middleware");

const {
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
} = require("../controllers/job.controller");

const router = express.Router();
router.use(authenticate);

router.post("/", createJob);

router.post("/delayed", createDelayedJob);

router.post("/recurring", createRecurringJob);

router.post("/pause", pauseQueue);

router.post("/resume", resumeQueue);

router.get("/", getAllJobs);

router.get("/failed", getFailedJobs);

router.post("/failed/:id/retry", retryFailedJob);

router.delete("/:id", cancelJob);

router.get("/:id", getJob);

module.exports = router;