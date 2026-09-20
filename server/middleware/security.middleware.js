const crypto = require("crypto");
const config = require("../config/env");

function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    if (config.isProduction) {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
}

function requireSystemAdmin(req, res, next) {
    const supplied = req.headers["x-admin-key"];
    if (!config.adminApiKey) {
        return res.status(503).json({ message: "Global queue administration is not configured" });
    }
    if (typeof supplied !== "string" || supplied.length !== config.adminApiKey.length) {
        return res.status(403).json({ message: "System administrator access required" });
    }
    const valid = crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(config.adminApiKey));
    if (!valid) return res.status(403).json({ message: "System administrator access required" });
    next();
}

module.exports = { securityHeaders, requireSystemAdmin };
