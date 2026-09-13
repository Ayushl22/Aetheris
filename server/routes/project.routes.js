const express = require("express");

const authenticate = require("../middleware/auth.middleware");

const {
    createProject,
    getProjects,
    getProject,
    deleteProject
} = require("../controllers/project.controller");

const router = express.Router();

router.use(authenticate);

router.post("/", createProject);

router.get("/", getProjects);

router.get("/:id", getProject);

router.delete("/:id", deleteProject);

module.exports = router;