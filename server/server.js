const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const config = require("./config/env");
const pool = require("./config/database");
const jobQueue = require("./queues/job.queue");
const deadLetterQueue = require("./queues/dead-letter.queue");
const { subscriber } = require("./config/pubsub");
const { createApp, originAllowed } = require("./app");
const migrate = require("./database/migrate");
const { startOutboxDispatcher } = require("./services/outbox.service");
const logger = require("./utils/logger");

let server;
let io;
let stopDispatcher;
let shuttingDown = false;

async function startServer() {
    await migrate();
    const app = createApp();
    server = http.createServer(app);
    io = new Server(server, {
        cors: {
            origin(origin, callback) {
                callback(originAllowed(origin, config.socketOrigins) ? null : new Error("Origin not allowed"), originAllowed(origin, config.socketOrigins));
            },
            methods: ["GET", "POST"]
        }
    });

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("Authentication required"));
            socket.user = jwt.verify(token, config.jwtSecret, {
                algorithms: ["HS256"], issuer: "aetheris", audience: "aetheris-dashboard"
            });
            next();
        } catch {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(`user:${socket.user.userId}`);
        logger.info("Socket connected", { socketId: socket.id, userId: socket.user.userId });
        socket.on("disconnect", () => logger.info("Socket disconnected", { socketId: socket.id, userId: socket.user.userId }));
    });

    await subscriber.connect();
    await subscriber.subscribe("job-events", (message) => {
        try {
            const event = JSON.parse(message);
            if (event?.userId) io.to(`user:${event.userId}`).emit("job-event", event);
        } catch (error) {
            logger.warn("Ignored malformed job event", { error: error.message });
        }
    });

    stopDispatcher = startOutboxDispatcher();
    await new Promise((resolve) => server.listen(config.port, resolve));
    logger.info("Aetheris server started", { port: config.port, environment: config.nodeEnv });
    return { app, server, io };
}

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Server shutdown started", { signal });
    const timeout = setTimeout(() => process.exit(1), 30000);
    timeout.unref();
    try {
        if (stopDispatcher) stopDispatcher();
        if (io) await new Promise((resolve) => io.close(resolve));
        if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        if (subscriber.isOpen) await subscriber.quit();
        await Promise.allSettled([jobQueue.close(), deadLetterQueue.close()]);
        await pool.end();
        clearTimeout(timeout);
        logger.info("Server shutdown complete");
        process.exit(0);
    } catch (error) {
        logger.error("Server shutdown failed", { error: error.message });
        process.exit(1);
    }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (require.main === module) {
    startServer().catch((error) => {
        logger.error("Server startup failed", { error: error.message });
        process.exitCode = 1;
    });
}

module.exports = { startServer, shutdown };
