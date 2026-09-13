const { createClient } = require("redis");

//two redis conection(publisher nd subscriber)
const publisher = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

const subscriber = publisher.duplicate();

module.exports = {
    publisher,
    subscriber
};