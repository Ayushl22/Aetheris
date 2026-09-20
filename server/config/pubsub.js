const { createClient } = require("redis");
const config = require("./env");

const publisher = createClient({
    url: config.redisUrl
});

const subscriber = publisher.duplicate();

publisher.on("error", (error) => console.error("Redis publisher error:", error.message));
subscriber.on("error", (error) => console.error("Redis subscriber error:", error.message));

module.exports = {
    publisher,
    subscriber
};
