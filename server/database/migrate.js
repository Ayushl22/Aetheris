const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query("SELECT pg_advisory_lock(hashtext('aetheris-schema-migrations'))");
        await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);

        const directory = path.join(__dirname, "migrations");
        const filenames = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();

        for (const filename of filenames) {
            const applied = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
            if (applied.rowCount > 0) continue;

            await client.query("BEGIN");
            try {
                await client.query(fs.readFileSync(path.join(directory, filename), "utf8"));
                await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
                await client.query("COMMIT");
                console.log(`Applied migration ${filename}`);
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
        }
    } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext('aetheris-schema-migrations'))").catch(() => undefined);
        client.release();
    }
}

if (require.main === module) {
    migrate()
        .then(() => console.log("Database migrations are current"))
        .catch((error) => {
            console.error("Database migration failed:", error.message);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}

module.exports = migrate;
