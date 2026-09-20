const { spawnSync } = require("child_process");

const baseUrl = process.env.TEST_API_URL || "http://127.0.0.1:53000";
const projectName = process.env.TEST_COMPOSE_PROJECT || "aetheris-integration";
const composeEnvFile = process.env.TEST_COMPOSE_ENV_FILE || "test/integration.compose.env.example";

async function request(path, { token, method = "GET", body } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000)
    });
    return { response, body: await response.json().catch(() => null) };
}

function compose(action) {
    const result = spawnSync(
        "docker",
        ["compose", "--project-name", projectName, "--env-file", composeEnvFile, action, "redis"],
        { cwd: process.cwd(), encoding: "utf8" }
    );
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `docker compose ${action} failed`);
}

async function main() {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const credentials = {
        name: "Redis outage test",
        email: `redis-outage-${suffix}@example.com`,
        password: "redis-outage-password-123"
    };

    const registered = await request("/auth/register", { method: "POST", body: credentials });

    if (registered.response.status !== 201) throw new Error(`registration returned ${registered.response.status}`);
    const login = await request("/auth/login", {
        method: "POST", body: { email: credentials.email, password: credentials.password }
    });

    if (login.response.status !== 200) throw new Error(`login returned ${login.response.status}`);

    const token = login.body.token;
    
    const project = await request("/projects", { token, method: "POST", body: { name: "Outage project" } });
    if (project.response.status !== 201) throw new Error(`project creation returned ${project.response.status}`);

    compose("stop");
    let accepted;
    try {
        accepted = await request("/jobs", {
            token,
            method: "POST",
            body: {
                projectId: project.body.project.id,
                type: "demo.success",
                data: { resilience: true },
                priority: "MEDIUM"
            }
        });
        if (accepted.response.status !== 202 || accepted.body.status !== "PENDING") {
            throw new Error(`Redis-outage submission returned ${accepted.response.status}/${accepted.body?.status}`);
        }
    } finally {
        compose("start");
    }

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
        const details = await request(`/jobs/${accepted.body.databaseJobId}`, { token });
        if (details.response.ok && details.body.job.status === "COMPLETED") {
            console.log("Redis outage recovery passed: request returned 202/PENDING and completed after Redis restarted");
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("Outbox job did not complete within 30 seconds after Redis restarted");
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
