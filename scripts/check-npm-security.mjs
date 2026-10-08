import { spawnSync } from "node:child_process";

// Temporary, reviewed exception: braces <=3.0.3 has no upstream patch
// (GHSA-vfj7-8cjw-p6xm). Allow only vulnerabilities that are wholly
// caused by that advisory; any other high/critical finding fails CI.
// Runtime dependencies are audited separately with --omit=dev.
const EXEMPT_ADVISORY = "GHSA-vfj7-8cjw-p6xm";
const EXCEPTION_EXPIRES_AT = Date.parse("2026-11-15T00:00:00Z");

const npm = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  maxBuffer: 24 * 1024 * 1024,
});
if (npm.error || !npm.stdout.trim()) {
  console.error("npm audit did not provide a report:", npm.error ?? npm.stderr);
  process.exit(1);
}
let report;
try {
  report = JSON.parse(npm.stdout);
} catch {
  console.error("npm audit returned invalid JSON:", npm.stdout.slice(0, 1000));
  process.exit(1);
}
if (report.error || !report.vulnerabilities || npm.status === null) {
  console.error("npm audit failed to complete:", JSON.stringify(report.error ?? npm.stderr));
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities;
function derivesExclusivelyFromBraces(name, seen = new Set()) {
  if (seen.has(name)) return false;
  const item = vulnerabilities[name];
  if (!item || !Array.isArray(item.via) || item.via.length === 0) return false;
  const nextSeen = new Set([...seen, name]);
  return item.via.every((reason) => {
    if (typeof reason === "string") {
      return derivesExclusivelyFromBraces(reason, nextSeen);
    }
    return (
      reason &&
      typeof reason === "object" &&
      reason.name === "braces" &&
      String(reason.url ?? "").includes(EXEMPT_ADVISORY)
    );
  });
}

const blocking = [];
const exempted = [];
for (const [name, item] of Object.entries(vulnerabilities)) {
  if (!["high", "critical"].includes(item.severity)) continue;
  if (derivesExclusivelyFromBraces(name)) {
    exempted.push(name);
  } else {
    blocking.push({ name, severity: item.severity, via: item.via });
  }
}
if (exempted.length && Date.now() >= EXCEPTION_EXPIRES_AT) {
  console.error("The temporary braces exception expired. Review the upstream advisory.");
  process.exit(1);
}
if (blocking.length) {
  console.error("Blocking npm security findings:", JSON.stringify(blocking, null, 2));
  process.exit(1);
}
if (npm.status !== 0 && !exempted.length) {
  console.error("npm audit failed without any recognized high/critical exception:", npm.stderr);
  process.exit(1);
}
console.log(
  `Full npm dependency audit passed: ${exempted.length} dev-only finding(s) ` +
  `transitively attributable only to unpatched ${EXEMPT_ADVISORY}; exception expires 2026-11-15.`,
);
