const express = require("express");

const authenticate = require("../middleware/auth.middleware");
const { asyncHandler } = require("../utils/errors");
const { validateProject } = require("../middleware/validation.middleware");

const {
    createProject,
    getProjects,
    getProject,
    deleteProject
} = require("../controllers/project.controller");

const router = express.Router();

router.use(authenticate);

router.post("/", validateProject, asyncHandler(createProject));

router.get("/", asyncHandler(getProjects));

router.get("/:id", asyncHandler(getProject));

router.delete("/:id", asyncHandler(deleteProject));

module.exports = router;
