const test = require("node:test");
const assert = require("node:assert/strict");
const { getHandler, listHandlers, listJobTypes } = require("../../worker/handlers");

test("handler registry exposes production and explicit demo handlers", () => {
    assert.ok(listHandlers().includes("notification.log"));
    assert.ok(listHandlers().includes("http.request"));
    assert.throws(() => getHandler("mail"), /No handler registered for job type: mail/);
    const metadata = listJobTypes();
    assert.equal(metadata.length, listHandlers().length);
    assert.ok(metadata.every((item) => item.type && item.label && item.description && Array.isArray(item.fields)));
    assert.equal("handler" in metadata[0], false);
});

test("notification handler validates and returns a useful result", async () => {
    const result = await getHandler("notification.log")({ message: "hello", channel: "audit" }, { attemptNumber: 1 });
    assert.equal(result.delivered, true);
    assert.equal(result.channel, "audit");
    assert.equal(result.messageLength, 5);
    await assert.rejects(() => getHandler("notification.log")({}, { attemptNumber: 1 }), /requires a message/);
});

test("demo handlers cover success, retry recovery, and final failure", async () => {
    assert.equal((await getHandler("demo.success")({ value: 1 }, { attemptNumber: 1 })).ok, true);
    await assert.rejects(() => getHandler("demo.fail")({}, { attemptNumber: 1 }), /Intentional/);
    await assert.rejects(() => getHandler("demo.flaky")({ failUntilAttempt: 1 }, { attemptNumber: 1 }), /attempt 1/);
    assert.equal((await getHandler("demo.flaky")({ failUntilAttempt: 1 }, { attemptNumber: 2 })).recoveredOnAttempt, 2);
});

test("HTTP handler blocks private-network targets", async () => {
    await assert.rejects(
        () => getHandler("http.request")({ url: "http://127.0.0.1/private", method: "GET" }, { attemptNumber: 1 }),
        /private/
    );
});
