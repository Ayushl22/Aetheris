const { AppError } = require("../utils/errors");
const { normalizePriority, normalizeJobType, normalizeData, normalizePositiveInteger, parseId } = require("../domain/jobs");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bodyObject(req) {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        throw new AppError(400, "A JSON object body is required", "VALIDATION_ERROR");
    }
    return req.body;
}

function validateRegister(req, res, next) {
    try {
        const body = bodyObject(req);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (name.length < 1 || name.length > 100) throw new AppError(400, "name must contain 1 to 100 characters", "VALIDATION_ERROR");
        if (!EMAIL_PATTERN.test(email) || email.length > 255) throw new AppError(400, "email must be valid", "VALIDATION_ERROR");
        if (password.length < 12 || password.length > 128) throw new AppError(400, "password must contain 12 to 128 characters", "VALIDATION_ERROR");
        req.validatedBody = { name, email, password };
        next();
    } catch (error) { next(error); }
}

function validateLogin(req, res, next) {
    try {
        const body = bodyObject(req);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!EMAIL_PATTERN.test(email) || !password) throw new AppError(400, "A valid email and password are required", "VALIDATION_ERROR");
        req.validatedBody = { email, password };
        next();
    } catch (error) { next(error); }
}

function validateProject(req, res, next) {
    try {
        const body = bodyObject(req);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (name.length < 1 || name.length > 100) throw new AppError(400, "name must contain 1 to 100 characters", "VALIDATION_ERROR");
        req.validatedBody = { name };
        next();
    } catch (error) { next(error); }
}

function validatedJob(body, { delayed = false, external = false } = {}) {
    const value = { type: normalizeJobType(body.type), data: normalizeData(body.data), priority: normalizePriority(body.priority) };
    if (!external) value.projectId = parseId(body.projectId, "projectId");
    if (delayed) value.delay = normalizePositiveInteger(body.delay, "delay", { min: 1, max: 2147483647 });
    return value;
}

function validateJob(req, res, next) {
    try { req.validatedBody = validatedJob(bodyObject(req)); next(); } catch (error) { next(error); }
}

function validateDelayedJob(req, res, next) {
    try { req.validatedBody = validatedJob(bodyObject(req), { delayed: true }); next(); } catch (error) { next(error); }
}

function validateExternalJob(req, res, next) {
    try {
        req.validatedBody = validatedJob(bodyObject(req), { external: true });
        const key = req.headers["idempotency-key"];
        if (typeof key !== "string" || !key.trim() || key.length > 255) {
            throw new AppError(400, "Idempotency-Key header must contain 1 to 255 characters", "VALIDATION_ERROR");
        }
        req.idempotencyKey = key.trim();
        next();
    } catch (error) { next(error); }
}

function validatedSchedule(body, { partial = false } = {}) {
    const value = {};
    if (!partial || body.type !== undefined) value.type = normalizeJobType(body.type);
    if (!partial || body.data !== undefined) value.data = normalizeData(body.data);
    if (!partial || body.every !== undefined || body.everyMs !== undefined) {
        value.everyMs = normalizePositiveInteger(body.everyMs ?? body.every, "every", { min: 1000, max: 2147483647 });
    }
    if (!partial || body.priority !== undefined) value.priority = normalizePriority(body.priority);
    if (!partial || body.maxAttempts !== undefined) {
        value.maxAttempts = normalizePositiveInteger(body.maxAttempts ?? 3, "maxAttempts", { min: 1, max: 20 });
    }
    return value;
}

function validateCreateSchedule(req, res, next) {
    try {
        const body = bodyObject(req);
        req.validatedBody = { projectId: parseId(body.projectId, "projectId"), ...validatedSchedule(body) };
        next();
    } catch (error) { next(error); }
}

function validateUpdateSchedule(req, res, next) {
    try {
        const value = validatedSchedule(bodyObject(req), { partial: true });
        if (Object.keys(value).length === 0) throw new AppError(400, "At least one schedule field is required", "VALIDATION_ERROR");
        req.validatedBody = value;
        next();
    } catch (error) { next(error); }
}

module.exports = {
    validateRegister, validateLogin, validateProject, validateJob, validateDelayedJob,
    validateExternalJob, validateCreateSchedule, validateUpdateSchedule
};
