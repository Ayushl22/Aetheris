const test = require("node:test");
const assert = require("node:assert/strict");
const {
    validateRegister, validateDelayedJob, validateCreateSchedule, validateExternalJob
} = require("../../server/middleware/validation.middleware");

function run(middleware, req) {
    let error;
    let called = false;
    middleware(req, {}, (value) => { error = value; called = true; });
    assert.equal(called, true);
    return error;
}

test("registration normalizes email and enforces password length", () => {
    const req = { body: { name: " Ayush ", email: " USER@EXAMPLE.COM ", password: "a-secure-password" } };
    assert.equal(run(validateRegister, req), undefined);
    assert.equal(req.validatedBody.email, "user@example.com");
    assert.match(run(validateRegister, { body: { name: "A", email: "a@b.com", password: "short" } }).message, /12/);
});

test("delayed jobs require owned-project input and a positive numeric delay", () => {
    const req = { body: { projectId: 7, type: "demo.success", data: {}, priority: "HIGH", delay: 500 } };
    assert.equal(run(validateDelayedJob, req), undefined);
    assert.equal(req.validatedBody.delay, 500);
    assert.equal(req.validatedBody.priority, 1);
    assert.match(run(validateDelayedJob, { body: { projectId: 7, type: "demo.success", delay: -1 } }).message, /delay/);
});

test("schedule validation supports multiple independent schedules", () => {
    const req = { body: { projectId: 2, type: "demo.success", data: {}, every: 1000, priority: "LOW", maxAttempts: 4 } };
    assert.equal(run(validateCreateSchedule, req), undefined);
    assert.equal(req.validatedBody.everyMs, 1000);
    assert.equal(req.validatedBody.maxAttempts, 4);
});

test("external jobs require a bounded idempotency key", () => {
    const req = { body: { type: "demo.success", data: {} }, headers: { "idempotency-key": "request-1" } };
    assert.equal(run(validateExternalJob, req), undefined);
    assert.equal(req.idempotencyKey, "request-1");
    assert.match(run(validateExternalJob, { body: { type: "demo.success" }, headers: {} }).message, /Idempotency-Key/);
});
