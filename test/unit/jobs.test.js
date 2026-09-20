const test = require("node:test");
const assert = require("node:assert/strict");
const {
    normalizePriority, normalizeJobType, normalizeData, normalizePositiveInteger, parseId
} = require("../../server/domain/jobs");

test("normalizes valid job priorities", () => {
    assert.equal(normalizePriority("HIGH"), 1);
    assert.equal(normalizePriority("medium"), 5);
    assert.equal(normalizePriority(10), 10);
});

test("rejects invalid priorities and job types", () => {
    assert.throws(() => normalizePriority("urgent"), /priority/);
    assert.throws(() => normalizeJobType("bad type"), /letters/);
    assert.equal(normalizeJobType("notification.log"), "notification.log");
});

test("accepts object data and rejects arrays", () => {
    assert.deepEqual(normalizeData(undefined), {});
    assert.deepEqual(normalizeData({ ok: true }), { ok: true });
    assert.throws(() => normalizeData([]), /JSON object/);
});

test("validates numeric identifiers and bounded integers", () => {
    assert.equal(parseId("42"), 42);
    assert.equal(normalizePositiveInteger("1000", "every", { min: 1000 }), 1000);
    assert.throws(() => parseId("0"), /between/);
    assert.throws(() => normalizePositiveInteger(-1, "delay"), /between/);
});
