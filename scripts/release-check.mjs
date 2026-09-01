import { spawnSync } from "node:child_process";

const level = process.argv[2] === "local" ? "local" : "pilot";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const results = [];

function run(label, command, args, environment = {}) {
  console.log(`\n[release:check] ${label}`);
  const result = spawnSync(command, args, { env: { ...process.env, ...environment }, stdio: "inherit" });
  results.push({ label, passed: result.status === 0 });
}

const clean = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
results.push({ label: "Working tree propre", passed: clean.status === 0 && clean.stdout.trim() === "" });
run("Scan de secrets", npm, ["run", "security:secrets"]);
run("Configuration release", npm, ["run", "security:release"]);
run("Lint", npm, ["run", "lint"]);
run("Typecheck", npm, ["run", "typecheck"]);
run("Vitest", npm, ["run", "test:unit"]);
run("Benchmark", npm, ["run", "test:benchmark"]);
run("Build local", npm, ["run", "build"], { APP_ENV: "local" });

const localReady = results.every((result) => result.passed);
let pilotReady = false;

if (level === "pilot") {
  run("Audit runtime", npm, ["audit", "--omit=dev", "--audit-level=high"]);
  run("Informations juridiques production", process.execPath, ["scripts/check-legal.mjs", "production"]);
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const stagingEvidence = process.env.STAGING_DEPLOYED_SHA === sha
    && process.env.STAGING_MIGRATIONS_STATUS === "passed"
    && process.env.STAGING_SMOKE_STATUS === "passed"
    && process.env.CI_STATUS === "passed"
    && process.env.E2E_STABILITY_STATUS === "passed";
  results.push({ label: "Preuves staging, CI et E2E", passed: stagingEvidence });
  pilotReady = localReady && results.every((result) => result.passed);
}

for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.label}`);
console.log(`LOCAL_READY=${localReady ? "YES" : "NO"}`);
console.log(`PILOT_READY=${pilotReady ? "YES" : "NO"}`);
process.exit(level === "local" ? (localReady ? 0 : 1) : (pilotReady ? 0 : 1));
