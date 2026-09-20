const { AppError } = require("../../server/utils/errors");

async function notificationHandler(data) {
    const message = typeof data.message === "string" ? data.message.trim() : "";
    if (!message || message.length > 5000) {
        throw new AppError(400, "notification.log requires a message of 1 to 5000 characters", "INVALID_JOB_DATA");
    }
    return {
        delivered: true,
        channel: data.channel || "log",
        messageLength: message.length,
        processedAt: new Date().toISOString()
    };
}

module.exports = notificationHandler;
