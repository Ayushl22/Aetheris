const notificationHandler = require("./notification.handler");
const httpHandler = require("./http.handler");
const { demoSuccess, demoFail, demoFlaky } = require("./demo.handler");

const registry = new Map();

function registerHandler({ type, label, description, fields = [], example = {}, handler }) {
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(type || "")) throw new Error(`Invalid registered job type: ${type}`);
    if (registry.has(type)) throw new Error(`Duplicate handler registration: ${type}`);
    if (typeof handler !== "function") throw new Error(`Handler for ${type} must be a function`);
    registry.set(type, Object.freeze({
        handler,
        metadata: Object.freeze({ type, label, description, fields, example })
    }));
}

registerHandler({
    type: "notification.log", label: "Notification",
    description: "Record a validated notification event and return delivery metadata.",
    fields: [
        { name: "message", label: "Message", type: "string", required: true, description: "Text to record (1–5,000 characters)." },
        { name: "channel", label: "Channel", type: "string", required: false, description: "Optional logical channel name." }
    ],
    example: { message: "Deployment completed", channel: "operations" }, handler: notificationHandler
});
registerHandler({
    type: "http.request", label: "HTTP request",
    description: "Call an allowlisted public HTTP endpoint with timeout and SSRF protection.",
    fields: [
        { name: "url", label: "URL", type: "url", required: true, description: "Public HTTP or HTTPS target." },
        { name: "method", label: "Method", type: "enum", required: false, options: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
        { name: "headers", label: "Headers", type: "object", required: false },
        { name: "body", label: "Body", type: "json", required: false }
    ],
    example: { url: "https://api.example.com/tasks", method: "POST", body: { event: "job.completed" } }, handler: httpHandler
});
registerHandler({
    type: "webhook", label: "Webhook",
    description: "Deliver an event payload to an allowlisted public webhook endpoint.",
    fields: [
        { name: "url", label: "Webhook URL", type: "url", required: true, description: "Public HTTP or HTTPS target." },
        { name: "method", label: "Method", type: "enum", required: false, options: ["POST", "PUT", "PATCH"] },
        { name: "headers", label: "Headers", type: "object", required: false },
        { name: "body", label: "Payload", type: "json", required: false }
    ],
    example: { url: "https://hooks.example.com/aetheris", method: "POST", body: { event: "build.ready" } }, handler: httpHandler
});
registerHandler({
    type: "demo.success", label: "Demo success",
    description: "Complete successfully and echo the payload. Intended for demos and verification.",
    fields: [], example: { message: "Hello Aetheris" }, handler: demoSuccess
});
registerHandler({
    type: "demo.flaky", label: "Demo retry",
    description: "Fail for a configured number of attempts, then succeed to demonstrate retries.",
    fields: [{ name: "failUntilAttempt", label: "Fail through attempt", type: "integer", required: false, description: "Defaults to 1." }],
    example: { failUntilAttempt: 1 }, handler: demoFlaky
});
registerHandler({
    type: "demo.fail", label: "Demo failure",
    description: "Always fail to demonstrate final failure and dead-letter handling.",
    fields: [{ name: "message", label: "Failure message", type: "string", required: false }],
    example: { message: "Intentional demo failure" }, handler: demoFail
});

function getHandler(type) {
    const registration = registry.get(type);
    if (!registration) throw new Error(`No handler registered for job type: ${type}`);
    return registration.handler;
}

function listHandlers() {
    return [...registry.keys()];
}

function listJobTypes() {
    return [...registry.values()].map(({ metadata }) => metadata);
}

module.exports = { registerHandler, getHandler, listHandlers, listJobTypes };
