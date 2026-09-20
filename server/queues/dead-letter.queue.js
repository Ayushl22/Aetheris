const {Queue} = require("bullmq");

const { producer: connection } = require("../config/redis.js");
const deadLetterQueue = new Queue("aetheris-dead-letter" , {
    connection
});

module.exports = deadLetterQueue;
