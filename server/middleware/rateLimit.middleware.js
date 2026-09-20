function createRateLimiter({ windowMs, limit, message }) {
    const buckets = new Map();
    const timer = setInterval(() => {
        const now = Date.now();
        for (const [key, value] of buckets) {
            if (value.resetAt <= now) buckets.delete(key);
        }
    }, Math.min(windowMs, 60000));
    timer.unref();

    return (req, res, next) => {
        const key = req.ip || req.socket.remoteAddress || "unknown";
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        res.setHeader("RateLimit-Limit", limit);
        res.setHeader("RateLimit-Remaining", Math.max(0, limit - bucket.count));
        res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
        if (bucket.count > limit) {
            res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
            return res.status(429).json({ message });
        }
        next();
    };
}

const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    message: "Too many authentication attempts. Try again later."
});

module.exports = { createRateLimiter, authRateLimiter };
