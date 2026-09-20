class AppError extends Error {
    constructor(statusCode, message, code = "REQUEST_ERROR", details = undefined) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

module.exports = { AppError, asyncHandler };
