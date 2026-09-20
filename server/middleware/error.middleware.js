const { AppError } = require("../utils/errors");
const logger = require("../utils/logger");

function notFound(req, res) {
    res.status(404).json({ message: "Route not found" });
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json({ message: "Request body contains invalid JSON", code: "INVALID_JSON" });
    }

    if (error?.code === "23505") {
        return res.status(409).json({ message: "A conflicting record already exists", code: "CONFLICT" });
    }

    const statusCode = error instanceof AppError ? error.statusCode : 500;
    if (statusCode >= 500) {
        logger.error("Unhandled request error", {
            method: req.method,
            path: req.originalUrl,
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    }

    res.status(statusCode).json({
        message: statusCode >= 500 ? "An internal server error occurred" : error.message,
        code: error.code || "INTERNAL_ERROR",
        ...(error.details ? { details: error.details } : {})
    });
}

module.exports = { notFound, errorHandler };
