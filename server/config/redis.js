const config = require("./env");

const redisUrl = new URL(config.redisUrl);
const baseConnection = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: redisUrl.pathname && redisUrl.pathname !== "/" ? Number(redisUrl.pathname.slice(1)) : 0,
    ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {})
};

module.exports = {
    worker: baseConnection,
    producer: {
        ...baseConnection,
        // HTTP requests must fall back to the PostgreSQL outbox quickly when
        // Redis is unavailable instead of waiting through unbounded retries.
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
    }
};
