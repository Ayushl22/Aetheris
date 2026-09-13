const { Queue } = require("bullmq");

const connection = require("../config/redis.js");

const jobQueue = new Queue("aetheris-jobs", {
    connection
});

module.exports = jobQueue;