const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const config = require("../config/env");

// Comparing against a real bcrypt hash keeps unknown-user logins on roughly
// the same timing path as wrong-password logins.
const DUMMY_PASSWORD_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5YAo3ETGxB7K6fYgK1j8fQHqVq5hK2u";

const register = async (req, res) => {
    const { name, email, password } = req.validatedBody;
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, name, email, created_at`,
        [name, email, passwordHash]
    );
    res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
};

const login = async (req, res) => {
    const { email, password } = req.validatedBody;
    const result = await pool.query("SELECT id, email, password_hash FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatch) return res.status(401).json({ message: "Invalid email or password" });
    const token = jwt.sign(
        { userId: user.id, email: user.email }, config.jwtSecret,
        { algorithm: "HS256", expiresIn: "1d", issuer: "aetheris", audience: "aetheris-dashboard" }
    );
    res.json({ message: "Login successful", token });
};

module.exports = { register, login };
