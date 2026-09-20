const pool = require("../config/database");
const { hashApiKey } = require("../utils/apiKey");
const { asyncHandler } = require("../utils/errors");

const authenticateApiKey = asyncHandler(async (req, res, next) => {
        const apiKey = req.headers["x-api-key"];

        if (!apiKey) {
            return res.status(401).json({
                message: "API key required"
            });
        }

        if (typeof apiKey !== "string" || apiKey.length > 255) {
            return res.status(401).json({ message: "Invalid API key" });
        }
        const apiKeyHash = hashApiKey(apiKey);
        let result = await pool.query(
            `SELECT id, name, user_id
            FROM projects
            WHERE api_key_hash = $1`,
            [apiKeyHash]
        );

        if (result.rows.length === 0) {
            result = await pool.query(
                `UPDATE projects SET api_key_hash = $1, api_key_prefix = $2,
                    api_key_last_four = $3, api_key = NULL
                 WHERE api_key = $4 RETURNING id, name, user_id`,
                [apiKeyHash, apiKey.slice(0, 13), apiKey.slice(-4), apiKey]
            );
        }

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid API key"
            });
        }

        req.project = result.rows[0];

        next();
});

module.exports = authenticateApiKey;
