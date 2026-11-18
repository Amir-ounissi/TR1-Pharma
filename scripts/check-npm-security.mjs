import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Temporary exception for GHSA-fc5q-39xc-vjpf (CVE-2026-112366).
// As of 2026-11-18, the GitHub Advisory Database lists no patched picomatch
// version. Permit only high/critical findings whose complete high-severity
// dependency chain terminates exclusively at this advisory.
// All picomatch copies must remain dev-only; the CI runtime audit below this
// step independently blocks high/critical production dependency findings.
const EXEMPT_ADVISORY = "GHSA-fc5q-39xc-vjpf";
const EXCEPTION_EXPIRES_AT = Date.parse("2026-11-25T00:00:00Z");

const npm = spawnSync("npm", ["audit", "--json", "--audit-level=high"], {
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
const isHighSeverity = (severity) => severity === "high" || severity === "critical";

function isAllowedAdvisory(reason) {
  return (
    reason &&
    typeof reason === "object" &&
    isHighSeverity(reason.severity) &&
    String(reason.url ?? "").includes(EXEMPT_ADVISORY)
  );
}

function highCausesAreAllowed(name, seen = new Set()) {
  if (seen.has(name)) return false;
  const item = vulnerabilities[name];
  if (!item || !Array.isArray(item.via)) return false;

  const nextSeen = new Set(seen);
  nextSeen.add(name);

  // npm audit includes lower-severity causes in the same dependency chain.
  // They do not justify an exception for a high/critical finding.
  const highCauses = item.via.filter((reason) => {
    if (typeof reason === "string") {
      return isHighSeverity(vulnerabilities[reason]?.severity);
    }
    return reason && typeof reason === "object" && isHighSeverity(reason.severity);
  });

  if (highCauses.length === 0) return false;
  return highCauses.every((reason) => {
    if (typeof reason === "string") {
      return highCausesAreAllowed(reason, nextSeen);
    }
    return isAllowedAdvisory(reason);
  });
}

const blocking = [];
const exempted = [];
for (const [name, item] of Object.entries(vulnerabilities)) {
  if (!isHighSeverity(item.severity)) continue;
  if (highCausesAreAllowed(name)) {
    exempted.push(name);
  } else {
    blocking.push({ name, severity: item.severity, via: item.via });
  }
}

if (exempted.length) {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const picomatchEntries = Object.entries(lock.packages ?? {}).filter(
    ([path]) => path === "node_modules/picomatch" || path.endsWith("/node_modules/picomatch"),
  );
  const advisoryPresent = vulnerabilities.picomatch?.via?.some(
    (reason) => isAllowedAdvisory(reason),
  );
  if (!advisoryPresent || picomatchEntries.length === 0 || picomatchEntries.some(([, item]) => item.dev !== true)) {
    console.error(
      "The temporary picomatch exception is allowed only when the exact advisory is present " +
      "and every installed picomatch copy is dev-only.",
    );
    process.exit(1);
  }
  if (Date.now() >= EXCEPTION_EXPIRES_AT) {
    console.error("The temporary picomatch exception expired. Re-check upstream remediation.");
    process.exit(1);
  }
}

if (blocking.length) {
  console.error("Blocking npm security findings:", JSON.stringify(blocking, null, 2));
  process.exit(1);
}
if (npm.status !== 0 && !exempted.length) {
  console.error("npm audit failed without a recognized temporary exception:", npm.stderr);
  process.exit(1);
}

console.log(
  `Full npm dependency audit passed: ${exempted.length} package finding(s) are temporarily ` +
  `attributable only to dev-only ${EXEMPT_ADVISORY}; exception expires 2026-11-25.`,
);
