const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const esbuild = require("../dashboard/node_modules/esbuild");

function walk(directory, predicate) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...walk(fullPath, predicate));
        else if (predicate(fullPath)) files.push(fullPath);
    }
    return files;
}

let failures = 0;
for (const file of [...walk("server", (name) => name.endsWith(".js")), ...walk("worker", (name) => name.endsWith(".js"))]) {
    const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (result.status !== 0) failures += 1;
}

for (const file of walk(path.join("dashboard", "src"), (name) => /\.(js|jsx)$/.test(name))) {
    try {
        esbuild.transformSync(fs.readFileSync(file, "utf8"), {
            loader: file.endsWith(".jsx") ? "jsx" : "js",
            jsx: "automatic"
        });
    } catch (error) {
        failures += 1;
        console.error(`Frontend parse failure in ${file}:\n${error.message}`);
    }
}

if (failures > 0) {
    console.error(`${failures} source checks failed`);
    process.exit(1);
}
console.log("Backend syntax and frontend parse checks passed");
