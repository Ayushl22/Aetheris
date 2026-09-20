const { Pool } = require("pg");
const config = require("./env");

const poolOptions = config.databaseUrl ? {
    connectionString: config.databaseUrl
} : {
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database
};

const pool = new Pool({
    ...poolOptions,
    ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
    max: config.postgres.poolMax,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    application_name: "aetheris"
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = pool;
