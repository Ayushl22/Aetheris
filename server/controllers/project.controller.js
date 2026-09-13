const crypto = require("crypto");
const pool = require("../config/database");

const createProject = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Project name is required"
            });
        }

        const apiKey = `aeth_${crypto.randomBytes(32).toString("hex")}`;

        const result = await pool.query(
            `INSERT INTO projects
            (user_id, name, api_key)
            VALUES ($1, $2, $3)
            RETURNING id, name, api_key, created_at`,
            [req.user.userId, name, apiKey]
        );

        res.status(201).json({
            message: "Project created successfully",
            project: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create project"
        });
    }
};


const getProjects = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, api_key, created_at
            FROM projects
            WHERE user_id = $1
            ORDER BY created_at DESC`,
            [req.user.userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get projects"
        });
    }
};


const getProject = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, api_key, created_at
            FROM projects
            WHERE id = $1
            AND user_id = $2`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to get project"
        });
    }
};


const deleteProject = async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM projects
            WHERE id = $1
            AND user_id = $2
            RETURNING id`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        res.json({
            message: "Project deleted successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete project"
        });
    }
};


module.exports = {
    createProject,
    getProjects,
    getProject,
    deleteProject
};