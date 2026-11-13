"use strict";

/**
 * Dependency audit gate.
 *
 * Runs `npm audit --omit=dev --json` and fails when a production dependency has
 * a high or critical advisory that is not covered by a current, reviewed entry
 * in backend/audit-exceptions.json. Moderate and low findings are reported but
 * do not fail the gate. Expired exceptions fail the gate.
 *
 * Usage: node scripts/audit-gate.js [--audit-json <file>] [--today YYYY-MM-DD]
 * The two flags exist for tests; CI runs it without arguments.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BLOCKING = new Set(["high", "critical"]);

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function loadAudit() {
  const file = argValue("--audit-json");
  if (file) return JSON.parse(fs.readFileSync(file, "utf8"));
  let out;
  try {
    out = execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // npm audit exits non-zero when it finds vulnerabilities; stdout still has the JSON.
    out = error.stdout;
  }
  return JSON.parse(out);
}

function loadExceptions() {
  const file = path.join(__dirname, "..", "audit-exceptions.json");
  return JSON.parse(fs.readFileSync(file, "utf8")).exceptions || [];
}

function advisoriesFor(vuln) {
  return [].concat(vuln.via || []).filter((v) => typeof v === "object" && v.url);
}

function advisoryId(url) {
  const m = /GHSA-[a-z0-9-]+/i.exec(String(url));
  return m ? m[0] : String(url);
}

function evaluate(audit, exceptions, today) {
  const failures = [];
  const accepted = [];
  const reported = [];

  for (const ex of exceptions) {
    if (!ex.expires || ex.expires < today) {
      failures.push(`exception ${ex.advisory} expired on ${ex.expires || "(no expiry)"}`);
    }
  }
  const current = exceptions.filter((ex) => ex.expires && ex.expires >= today);

  for (const [name, vuln] of Object.entries(audit.vulnerabilities || {})) {
    if (!BLOCKING.has(vuln.severity)) {
      reported.push(`${name} (${vuln.severity})`);
      continue;
    }
    const direct = advisoriesFor(vuln).map((a) => advisoryId(a.url));
    // Transitive-only entries ("via": ["zod"]) inherit the ids of what they point to.
    const ids = direct.length
      ? direct
      : []
          .concat(vuln.via || [])
          .filter((v) => typeof v === "string")
          .flatMap((dep) =>
            advisoriesFor(audit.vulnerabilities[dep] || {}).map((a) => advisoryId(a.url))
          );
    const uncovered = ids.filter(
      (id) => !current.some((ex) => ex.advisory === id && (ex.packages || []).includes(name))
    );
    if (ids.length === 0 || uncovered.length > 0) {
      failures.push(`${name} (${vuln.severity}) ${uncovered.join(", ") || "unknown advisory"}`);
    } else {
      accepted.push(`${name} (${vuln.severity}) ${ids.join(", ")}`);
    }
  }
  return { failures, accepted, reported };
}

function main() {
  const today = argValue("--today") || new Date().toISOString().slice(0, 10);
  const { failures, accepted, reported } = evaluate(loadAudit(), loadExceptions(), today);
  for (const line of accepted) console.log(`ACCEPTED (reviewed exception): ${line}`);
  for (const line of reported) console.log(`REPORTED (non-blocking): ${line}`);
  if (failures.length) {
    for (const line of failures) console.error(`BLOCKING: ${line}`);
    process.exit(1);
  }
  console.log("Dependency audit gate passed.");
}

if (require.main === module) main();

module.exports = { evaluate };
