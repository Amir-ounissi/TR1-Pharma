import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const requestedMode = process.argv[2] ?? "strict";
const allowedModes = new Set(["staging", "preflight", "strict"]);
if (!allowedModes.has(requestedMode)) {
  throw new Error(`Mode inconnu: ${requestedMode}. Utilisez staging, preflight ou strict.`);
}
const mode = requestedMode;

const migrationDir = join(process.cwd(), "supabase", "migrations");
const localVersions = readdirSync(migrationDir)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .map((name) => name.slice(0, 14))
  .sort();

if (localVersions.length === 0) {
  throw new Error("Aucune migration locale détectée.");
}

if (new Set(localVersions).size !== localVersions.length) {
  throw new Error("Deux migrations locales partagent le même timestamp.");
}

function migrationList(databaseUrl, label) {
  if (!databaseUrl) throw new Error(`${label}: URL de base absente.`);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npm,
    ["exec", "--", "supabase", "migration", "list", "--db-url", databaseUrl],
    {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    },
  );

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label}: impossible de lire l'historique distant.\n${details}`);
  }

  const remoteVersions = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    const columns = line.split(/[│|]/).map((value) => value.trim());
    if (columns.length < 2) continue;
    // Supabase CLI renders "Local | Remote | Time". On some CLI/output
    // variants (including pooler-backed connections), the remote version can
    // be the first timestamp column instead of a fixed second column.
    const versions = columns.filter((value) => /^\d{14}$/.test(value));
    const remote = versions.length >= 2 ? versions[1] : versions[0] ?? null;
    if (remote) remoteVersions.push(remote);
  }

  if (remoteVersions.length === 0) {
    throw new Error(`${label}: aucune migration distante détectée. Refus de continuer.`);
  }

  return remoteVersions;
}

function assertExact(label, remoteVersions) {
  const local = localVersions.join("\n");
  const remote = remoteVersions.join("\n");
  if (local !== remote) {
    const missingRemote = localVersions.filter((version) => !remoteVersions.includes(version));
    const unknownRemote = remoteVersions.filter((version) => !localVersions.includes(version));
    throw new Error(
      `${label}: dérive de migrations. `
      + `Absentes à distance: ${missingRemote.join(", ") || "aucune"}. `
      + `Inconnues dans Git: ${unknownRemote.join(", ") || "aucune"}.`,
    );
  }
}

function assertPrefix(label, remoteVersions) {
  if (remoteVersions.length > localVersions.length) {
    throw new Error(`${label}: la base contient plus de migrations que le SHA Git.`);
  }
  for (let index = 0; index < remoteVersions.length; index += 1) {
    if (remoteVersions[index] !== localVersions[index]) {
      throw new Error(
        `${label}: historique divergent à la position ${index + 1} `
        + `(Git=${localVersions[index] ?? "absent"}, distant=${remoteVersions[index]}).`,
      );
    }
  }
}

const stagingVersions = migrationList(process.env.STAGING_DATABASE_URL, "staging");
assertExact("staging", stagingVersions);

if (mode === "staging") {
  console.log("Migration drift gate: PASS (staging).");
  console.log(`Git=${localVersions.length} staging=${stagingVersions.length}`);
  process.exit(0);
}

const productionVersions = migrationList(process.env.PRODUCTION_DATABASE_URL, "production");
if (mode === "preflight") {
  assertPrefix("production", productionVersions);
} else {
  assertExact("production", productionVersions);
  if (stagingVersions.join("\n") !== productionVersions.join("\n")) {
    throw new Error("staging et production n'ont pas le même historique de migrations.");
  }
}

console.log(`Migration drift gate: PASS (${mode}).`);
console.log(`Git=${localVersions.length} staging=${stagingVersions.length} production=${productionVersions.length}`);
