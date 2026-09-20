const test = require("node:test");
const assert = require("node:assert/strict");

const enabled = process.env.RUN_INTEGRATION_TESTS === "1";
const baseUrl = process.env.TEST_API_URL || "http://127.0.0.1:3000";
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { token, method = "GET", body, headers = {} } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => null);
    return { response, payload };
}

async function createUser(label) {
    const email = `${label}-${suffix}@example.com`;
    const password = "integration-password-123";
    assert.equal((await request("/auth/register", { method: "POST", body: { name: label, email, password } })).response.status, 201);
    const login = await request("/auth/login", { method: "POST", body: { email, password } });
    assert.equal(login.response.status, 200);
    return { email, password, token: login.payload.token };
}

async function waitForJob(token, databaseJobId, statuses, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const result = await request(`/jobs/${databaseJobId}`, { token });
        if (result.response.ok && statuses.includes(result.payload.job.status)) return result.payload;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Job ${databaseJobId} did not reach ${statuses.join("/")}`);
}

test("full authenticated multi-tenant job lifecycle", { skip: !enabled, timeout: 90000 }, async () => {
    const owner = await createUser("owner");
    const stranger = await createUser("stranger");

    const jobTypes = await request("/jobs/types", { token: owner.token });
    assert.equal(jobTypes.response.status, 200);
    assert.ok(jobTypes.payload.some((entry) => entry.type === "notification.log"));
    assert.equal(jobTypes.payload.some((entry) => entry.type === "mail"), false);

    const invalidLogin = await request("/auth/login", { method: "POST", body: { email: owner.email, password: "wrong-password-value" } });
    assert.equal(invalidLogin.response.status, 401);
    const duplicate = await request("/auth/register", { method: "POST", body: { name: "Duplicate", email: owner.email, password: owner.password } });
    assert.equal(duplicate.response.status, 409);

    const projectResult = await request("/projects", { token: owner.token, method: "POST", body: { name: "Primary" } });
    const otherProjectResult = await request("/projects", { token: stranger.token, method: "POST", body: { name: "Other" } });
    assert.equal(projectResult.response.status, 201);
    const project = projectResult.payload.project;
    const otherProject = otherProjectResult.payload.project;
    assert.ok(project.api_key);
    const list = await request("/projects", { token: owner.token });
    assert.equal(list.payload.length, 1);
    assert.equal(list.payload[0].api_key, undefined);
    assert.equal((await request(`/projects/${otherProject.id}`, { token: owner.token })).response.status, 404);
    assert.equal((await request(`/projects/${otherProject.id}`, { token: owner.token, method: "DELETE" })).response.status, 404);

    const external1 = await request("/api/v1/jobs", {
        method: "POST", headers: { "X-API-Key": project.api_key, "Idempotency-Key": `integration-${suffix}` },
        body: { type: "demo.success", data: { source: "external" }, priority: "MEDIUM" }
    });
    const external2 = await request("/api/v1/jobs", {
        method: "POST", headers: { "X-API-Key": project.api_key, "Idempotency-Key": `integration-${suffix}` },
        body: { type: "demo.success", data: { source: "external" }, priority: "MEDIUM" }
    });
    assert.ok([201, 202].includes(external1.response.status));
    assert.equal(external2.response.status, 200);
    assert.equal(external2.payload.databaseJobId, external1.payload.databaseJobId);
    await waitForJob(owner.token, external1.payload.databaseJobId, ["COMPLETED"]);

    const jobResult = await request("/jobs", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "demo.success", data: { hello: "world" }, priority: "HIGH" }
    });
    assert.ok([201, 202].includes(jobResult.response.status));
    const completed = await waitForJob(owner.token, jobResult.payload.databaseJobId, ["COMPLETED"]);
    assert.equal(completed.job.priority, 1);
    assert.equal(completed.attempts.length, 1);
    assert.equal((await request(`/jobs/${jobResult.payload.databaseJobId}`, { token: stranger.token })).response.status, 404);

    const delayed = await request("/jobs/delayed", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "demo.success", data: {}, priority: "LOW", delay: 250 }
    });
    assert.ok([201, 202].includes(delayed.response.status));
    assert.equal((await request(`/jobs/${delayed.payload.jobId}`, { token: stranger.token, method: "DELETE" })).response.status, 404);
    await waitForJob(owner.token, delayed.payload.databaseJobId, ["COMPLETED"]);

    const cancellable = await request("/jobs/delayed", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "demo.success", data: {}, priority: "MEDIUM", delay: 60000 }
    });
    assert.equal((await request(`/jobs/${cancellable.payload.jobId}`, { token: owner.token, method: "DELETE" })).response.status, 200);
    const cancelled = await waitForJob(owner.token, cancellable.payload.databaseJobId, ["CANCELLED"]);
    assert.equal(cancelled.job.status, "CANCELLED");

    const flaky = await request("/jobs", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "demo.flaky", data: { failUntilAttempt: 1 }, priority: "MEDIUM" }
    });
    const recovered = await waitForJob(owner.token, flaky.payload.databaseJobId, ["COMPLETED"], 30000);
    assert.equal(recovered.attempts.length, 2);
    assert.equal(recovered.attempts[0].status, "FAILED");

    const failed = await request("/jobs", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "demo.fail", data: {}, priority: "MEDIUM" }
    });
    await waitForJob(owner.token, failed.payload.databaseJobId, ["FAILED"], 30000);
    const ownerDlq = await request("/jobs/failed", { token: owner.token });
    const dlq = ownerDlq.payload.find((entry) => String(entry.job_id) === String(failed.payload.databaseJobId));
    assert.ok(dlq?.dlq_id);
    const strangerDlq = await request("/jobs/failed", { token: stranger.token });
    assert.equal(strangerDlq.payload.some((entry) => entry.dlq_id === dlq.dlq_id), false);
    assert.equal((await request(`/jobs/failed/${dlq.dlq_id}/retry`, { token: stranger.token, method: "POST" })).response.status, 404);
    assert.equal((await request(`/jobs/failed/${dlq.dlq_id}/retry`, { token: owner.token, method: "POST" })).response.status, 202);

    const unsupported = await request("/jobs", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "custom-task", data: {}, priority: "MEDIUM" }
    });
    const unsupportedFailure = await waitForJob(owner.token, unsupported.payload.databaseJobId, ["FAILED"], 30000);
    assert.match(unsupportedFailure.job.error, /No handler registered for job type: custom-task/);

    const schedule1 = await request("/jobs/recurring", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "demo.success", data: {}, every: 60000, priority: "MEDIUM" }
    });
    const schedule2 = await request("/jobs/recurring", {
        token: owner.token, method: "POST",
        body: { projectId: project.id, type: "demo.success", data: {}, every: 120000, priority: "LOW" }
    });
    assert.notEqual(schedule1.payload.scheduleId, schedule2.payload.scheduleId);
    assert.equal((await request(`/jobs/recurring/${schedule1.payload.scheduleId}`, { token: owner.token, method: "PATCH", body: { every: 90000 } })).response.status, 200);
    assert.equal((await request(`/jobs/recurring/${schedule1.payload.scheduleId}`, { token: stranger.token, method: "DELETE" })).response.status, 404);
    assert.equal((await request(`/jobs/recurring/${schedule1.payload.scheduleId}`, { token: owner.token, method: "DELETE" })).response.status, 200);
    assert.equal((await request(`/jobs/recurring/${schedule2.payload.scheduleId}`, { token: owner.token, method: "DELETE" })).response.status, 200);

    assert.equal((await request("/jobs/pause", { token: owner.token, method: "POST" })).response.status, 503);

    const disposableResult = await request("/projects", { token: owner.token, method: "POST", body: { name: "Disposable" } });
    const disposable = disposableResult.payload.project;
    const disposableSchedule = await request("/jobs/recurring", {
        token: owner.token, method: "POST",
        body: { projectId: disposable.id, type: "demo.success", data: {}, every: 60000, priority: "MEDIUM" }
    });
    const disposableJob = await request("/jobs/delayed", {
        token: owner.token, method: "POST",
        body: { projectId: disposable.id, type: "demo.success", data: {}, priority: "MEDIUM", delay: 60000 }
    });
    assert.ok(disposableSchedule.payload.scheduleId);
    assert.ok(disposableJob.payload.databaseJobId);
    assert.equal((await request(`/projects/${disposable.id}`, { token: owner.token, method: "DELETE" })).response.status, 200);
    assert.equal((await request(`/projects/${disposable.id}`, { token: owner.token })).response.status, 404);
    const schedulesAfterDelete = await request(`/jobs/recurring?projectId=${disposable.id}`, { token: owner.token });
    assert.deepEqual(schedulesAfterDelete.payload, []);

    const invalid = await request("/jobs/delayed", {
        token: owner.token, method: "POST", body: { projectId: project.id, type: "bad type", delay: -1 }
    });
    assert.equal(invalid.response.status, 400);
    assert.equal((await request("/jobs", {})).response.status, 401);

    let rateLimited = false;
    for (let index = 0; index < 25; index += 1) {
        const response = await request("/auth/login", {
            method: "POST", body: { email: `missing-${index}-${suffix}@example.com`, password: "wrong-password-value" }
        });
        if (response.response.status === 429) { rateLimited = true; break; }
    }
    assert.equal(rateLimited, true);
});
