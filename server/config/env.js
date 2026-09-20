const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: process.env.ENV_FILE || path.resolve(__dirname, "../../.env") });

function integer(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
    const raw = process.env[name];
    const value = raw === undefined || raw === "" ? fallback : Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer between ${min} and ${max}`);
    }
    return value;
}

function boolean(name, fallback = false) {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return fallback;
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new Error(`${name} must be true or false`);
}

function list(name, fallback = []) {
    const raw = process.env[name];
    return raw ? raw.split(",").map((value) => value.trim()).filter(Boolean) : fallback;
}

function required(name, minimumLength = 1) {
    const value = process.env[name];
    if (!value || value.length < minimumLength) {
        throw new Error(`${name} is required and must contain at least ${minimumLength} characters`);
    }
    return value;
}

const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";
const defaultOrigins = isProduction ? [] : ["http://localhost:5173"];

const config = Object.freeze({
    nodeEnv: process.env.NODE_ENV || "development",
    isProduction,
    isTest,
    port: integer("PORT", 3000, { min: 1, max: 65535 }),
    databaseUrl: process.env.DATABASE_URL || "",
    postgres: {
        host: process.env.POSTGRES_HOST || "localhost",
        port: integer("POSTGRES_PORT", 5432, { min: 1, max: 65535 }),
        user: process.env.POSTGRES_USER || "aetheris",
        password: process.env.POSTGRES_PASSWORD || "",
        database: process.env.POSTGRES_DB || "aetheris",
        ssl: boolean("POSTGRES_SSL", false),
        poolMax: integer("POSTGRES_POOL_MAX", 10, { min: 1, max: 100 })
    },
    redisUrl: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    jwtSecret: isTest ? (process.env.JWT_SECRET || "test-secret-with-at-least-32-characters") : required("JWT_SECRET", 32),
    apiKeyPepper: isTest ? (process.env.API_KEY_PEPPER || "test-pepper-with-at-least-32-characters") : required("API_KEY_PEPPER", 32),
    adminApiKey: process.env.ADMIN_API_KEY || "",
    corsOrigins: list("CORS_ALLOWED_ORIGINS", defaultOrigins),
    socketOrigins: list("SOCKET_ALLOWED_ORIGINS", defaultOrigins),
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || "100kb",
    workerConcurrency: integer("WORKER_CONCURRENCY", 3, { min: 1, max: 100 }),
    outboxPollIntervalMs: integer("OUTBOX_POLL_INTERVAL_MS", 2000, { min: 250, max: 60000 }),
    retention: {
        completeAge: integer("JOB_RETENTION_COMPLETE_AGE_SECONDS", 86400, { min: 60 }),
        completeCount: integer("JOB_RETENTION_COMPLETE_COUNT", 1000, { min: 1 }),
        failAge: integer("JOB_RETENTION_FAIL_AGE_SECONDS", 604800, { min: 60 }),
        failCount: integer("JOB_RETENTION_FAIL_COUNT", 5000, { min: 1 })
    },
    httpJob: {
        timeoutMs: integer("HTTP_JOB_TIMEOUT_MS", 10000, { min: 100, max: 120000 }),
        allowedHosts: list("HTTP_JOB_ALLOWED_HOSTS")
    }
});

if (!config.databaseUrl && !config.postgres.password && isProduction) {
    throw new Error("DATABASE_URL or POSTGRES_PASSWORD is required in production");
}
if (isProduction && config.corsOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS is required in production");
}
if (isProduction && config.socketOrigins.length === 0) {
    throw new Error("SOCKET_ALLOWED_ORIGINS is required in production");
}

module.exports = config;
