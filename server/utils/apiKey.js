const crypto = require("crypto");
const config = require("../config/env");

function createApiKey() {
    const secret = crypto.randomBytes(32).toString("hex");
    const apiKey = `aeth_${secret}`;
    return {
        apiKey,
        hash: hashApiKey(apiKey),
        prefix: apiKey.slice(0, 13),
        lastFour: apiKey.slice(-4)
    };
}

function hashApiKey(apiKey) {
    return crypto.createHmac("sha256", config.apiKeyPepper).update(apiKey).digest("hex");
}

module.exports = { createApiKey, hashApiKey };
