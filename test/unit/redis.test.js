const test = require("node:test");
const assert = require("node:assert/strict");
const { producer, worker } = require("../../server/config/redis");

test("API queue producers fail fast so PostgreSQL outbox delivery can take over", () => {
    assert.equal(producer.maxRetriesPerRequest, 1);
    assert.equal(producer.enableOfflineQueue, false);
    assert.equal(worker.maxRetriesPerRequest, undefined);
    assert.equal(worker.enableOfflineQueue, undefined);
});
