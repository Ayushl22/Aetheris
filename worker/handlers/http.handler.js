const dns = require("dns").promises;
const net = require("net");
const config = require("../../server/config/env");

function isPrivateAddress(address) {
    if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
    if (net.isIPv4(address)) {
        const [a, b] = address.split(".").map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
    }
    const normalized = address.toLowerCase();
    return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function validateTarget(rawUrl) {
    let url;
    try { url = new URL(rawUrl); } catch { throw new Error("http.request requires a valid URL"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("http.request supports credential-free HTTP and HTTPS URLs only");
    }
    if (config.isProduction && config.httpJob.allowedHosts.length === 0) {
        throw new Error("HTTP jobs require HTTP_JOB_ALLOWED_HOSTS in production");
    }
    if (config.httpJob.allowedHosts.length > 0 && !config.httpJob.allowedHosts.includes(url.hostname)) {
        throw new Error("HTTP target host is not allowed");
    }
    const addresses = await dns.lookup(url.hostname, { all: true });
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new Error("HTTP target resolves to a private or unsupported address");
    }
    return url;
}

async function httpHandler(data) {
    const url = await validateTarget(data.url);
    const method = String(data.method || "POST").toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error("Unsupported HTTP method");
    const headers = {};
    if (data.headers !== undefined) {
        if (!data.headers || typeof data.headers !== "object" || Array.isArray(data.headers)) throw new Error("headers must be an object");
        for (const [name, value] of Object.entries(data.headers)) {
            const normalized = name.toLowerCase();
            if (["host", "content-length", "connection", "transfer-encoding"].includes(normalized)) continue;
            if (typeof value !== "string") throw new Error("HTTP header values must be strings");
            headers[name] = value;
        }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.httpJob.timeoutMs);
    try {
        const response = await fetch(url, {
            method,
            headers,
            body: ["GET", "DELETE"].includes(method) || data.body === undefined
                ? undefined
                : (typeof data.body === "string" ? data.body : JSON.stringify(data.body)),
            redirect: "error",
            signal: controller.signal
        });
        const text = (await response.text()).slice(0, 10000);
        if (!response.ok) throw new Error(`HTTP target returned status ${response.status}`);
        return { status: response.status, contentType: response.headers.get("content-type"), bodyPreview: text };
    } finally { clearTimeout(timeout); }
}

module.exports = httpHandler;
