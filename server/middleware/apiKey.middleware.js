const pool = require("../config/database");

const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers["x-api-key"];

        if (!apiKey) {
            return res.status(401).json({
                message: "API key required"
            });
        }

        const result = await pool.query(
            `SELECT id, name, user_id
            FROM projects
            WHERE api_key = $1`,
            [apiKey]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid API key"
            });
        }

        req.project = result.rows[0];

        next();

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "API key authentication failed"
        });
    }
};

module.exports = authenticateApiKey;