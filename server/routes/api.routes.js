const express = require("express");

const authenticateApiKey = require("../middleware/apiKey.middleware");
const { validateExternalJob } = require("../middleware/validation.middleware");
const { asyncHandler } = require("../utils/errors");
const {
    createApiJob
} = require("../controllers/api.controller");

const router = express.Router();

router.use(authenticateApiKey);

router.post("/jobs", validateExternalJob, asyncHandler(createApiJob));

module.exports = router;
