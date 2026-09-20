const { AppError } = require("../utils/errors");

const PRIORITIES = Object.freeze({ HIGH: 1, MEDIUM: 5, LOW: 10 });

function normalizePriority(value = "MEDIUM") {
    if (typeof value === "number" && [1, 5, 10].includes(value)) return value;
    const normalized = String(value).trim().toUpperCase();
    if (!(normalized in PRIORITIES)) {
        throw new AppError(400, "priority must be HIGH, MEDIUM, LOW, 1, 5, or 10", "VALIDATION_ERROR");
    }
    return PRIORITIES[normalized];
}

function normalizeJobType(value) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
        throw new AppError(400, "type must be a non-empty string of at most 100 characters", "VALIDATION_ERROR");
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(value.trim())) {
        throw new AppError(400, "type may contain only letters, numbers, dots, underscores, and hyphens", "VALIDATION_ERROR");
    }
    return value.trim();
}

function normalizeData(value) {
    if (value === undefined || value === null) return {};
    if (typeof value !== "object" || Array.isArray(value)) {
        throw new AppError(400, "data must be a JSON object", "VALIDATION_ERROR");
    }
    return value;
}

function normalizePositiveInteger(value, name, { min = 0, max = 2147483647 } = {}) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        throw new AppError(400, `${name} must be an integer between ${min} and ${max}`, "VALIDATION_ERROR");
    }
    return number;
}

function parseId(value, name = "id") {
    return normalizePositiveInteger(value, name, { min: 1, max: Number.MAX_SAFE_INTEGER });
}

module.exports = {
    PRIORITIES,
    normalizePriority,
    normalizeJobType,
    normalizeData,
    normalizePositiveInteger,
    parseId
};
