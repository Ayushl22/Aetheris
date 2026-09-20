const express = require("express");
const { asyncHandler } = require("../utils/errors");
const { authRateLimiter } = require("../middleware/rateLimit.middleware");
const { validateRegister, validateLogin } = require("../middleware/validation.middleware");

const {
    register,
    login
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", authRateLimiter, validateRegister, asyncHandler(register));
router.post("/login", authRateLimiter, validateLogin, asyncHandler(login));

module.exports = router;
