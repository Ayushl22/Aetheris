const { publisher } = require("../config/pubsub");
const logger = require("../utils/logger");

async function ensurePublisher() {
    if (!publisher.isOpen) await publisher.connect();
}

async function publishJobEvent(event) {
    try {
        await ensurePublisher();
        await publisher.publish("job-events", JSON.stringify(event));
    } catch (error) {
        logger.warn("Unable to publish job event", { event: event.event, jobId: event.jobId, error: error.message });
    }
}

module.exports = { ensurePublisher, publishJobEvent };
