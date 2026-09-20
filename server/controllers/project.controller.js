const pool = require("../config/database");
const { createApiKey } = require("../utils/apiKey");
const { parseId } = require("../domain/jobs");
const { deleteProjectSafely } = require("../services/project.service");

const createProject = async (req, res) => {
    const { name } = req.validatedBody;
    const key = createApiKey();
    const result = await pool.query(
        `INSERT INTO projects (user_id, name, api_key_hash, api_key_prefix, api_key_last_four)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, api_key_prefix, api_key_last_four, created_at`,
        [req.user.userId, name, key.hash, key.prefix, key.lastFour]
    );
    res.status(201).json({
        message: "Project created successfully. Store the API key now; it will not be shown again.",
        project: { ...result.rows[0], api_key: key.apiKey }
    });
};

const getProjects = async (req, res) => {
    const result = await pool.query(
        `SELECT p.id, p.name, p.api_key_prefix, p.api_key_last_four, p.created_at,
                COUNT(j.id)::integer AS job_count
         FROM projects p LEFT JOIN jobs j ON j.project_id = p.id
         WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC`, [req.user.userId]
    );
    res.json(result.rows);
};

const getProject = async (req, res) => {
    const id = parseId(req.params.id);
    const result = await pool.query(
        `SELECT p.id, p.name, p.api_key_prefix, p.api_key_last_four, p.created_at,
                COUNT(j.id)::integer AS job_count
         FROM projects p LEFT JOIN jobs j ON j.project_id = p.id
         WHERE p.id = $1 AND p.user_id = $2 GROUP BY p.id`, [id, req.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Project not found" });
    res.json(result.rows[0]);
};

const deleteProject = async (req, res) => {
    await deleteProjectSafely(parseId(req.params.id), req.user.userId);
    res.json({ message: "Project and its queued work were deleted successfully" });
};

module.exports = { createProject, getProjects, getProject, deleteProject };
