const express = require("express");

const authenticateApiKey = require("../middleware/apiKey.middleware");
const {
    createApiJob
} = require("../controllers/api.controller");

const router = express.Router();

router.use(authenticateApiKey);

router.post("/jobs", createApiJob);

module.exports = router;