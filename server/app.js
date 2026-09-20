const express = require("express");
const cors = require("cors");
const config = require("./config/env");
const pool = require("./config/database");
const jobQueue = require("./queues/job.queue");
const { AppError } = require("./utils/errors");
const { securityHeaders } = require("./middleware/security.middleware");
const { notFound, errorHandler } = require("./middleware/error.middleware");
const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const jobRoutes = require("./routes/job.routes");
const apiRoutes = require("./routes/api.routes");

function originAllowed(origin, allowedOrigins) {
    return !origin || allowedOrigins.includes(origin);
}

function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    app.use(securityHeaders);
    app.use(cors({
        origin(origin, callback) {
            if (originAllowed(origin, config.corsOrigins)) callback(null, true);
            else callback(new AppError(403, "Origin is not allowed", "CORS_DENIED"));
        },
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "Idempotency-Key", "X-Admin-Key"],
        maxAge: 86400
    }));
    app.use(express.json({ limit: config.jsonBodyLimit, strict: true }));

    app.get("/health", (req, res) => res.json({ status: "ok", service: "aetheris-api", checks: { api: "healthy" } }));
    app.get("/ready", async (req, res) => {
        const [database, redis] = await Promise.allSettled([
            pool.query("SELECT 1"),
            jobQueue.getJobCounts("waiting")
        ]);
        const checks = {
            database: database.status === "fulfilled" ? "healthy" : "unavailable",
            redis: redis.status === "fulfilled" ? "healthy" : "unavailable",
            queue: redis.status === "fulfilled" ? "healthy" : "unavailable"
        };
        const ready = database.status === "fulfilled" && redis.status === "fulfilled";
        res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready", checks });
    });
    app.use("/auth", authRoutes);
    app.use("/projects", projectRoutes);
    app.use("/jobs", jobRoutes);
    app.use("/api/v1", apiRoutes);
    app.use(notFound);
    app.use(errorHandler);
    return app;
}

module.exports = { createApp, originAllowed };
