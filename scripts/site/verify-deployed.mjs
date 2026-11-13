#!/usr/bin/env node
/**
 * Checks what a deployed origin actually serves.
 *
 *   node scripts/site/verify-deployed.mjs https://biugacademy.org [--retries 10] [--delay-ms 30000]
 *
 * Positive: every required public path returns 200.
 * Negative: every git-tracked file that the allowlist excludes (backend,
 * migrations, Apps Script, internal docs, configuration, tests), plus a fixed
 * list of sensitive probes (.env, .git/config), must NOT return 200.
 *
 * Retries the whole check to allow for CDN propagation after a deploy.
 * Prints paths and status codes only; it never prints response bodies.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowed, loadConfig, trackedFiles } from "./build-site.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const SENSITIVE_PROBES = [
  ".env",
  "backend/.env",
  ".git/config",
  ".git/HEAD",
  "backend/node_modules/.package-lock.json",
];

export function expectedPaths(files, config) {
  const required = config.required.map((r) => (r === "assets" ? null : r)).filter(Boolean);
  const excluded = files.filter((f) => !isAllowed(f, config));
  return { required, mustNotServe: [...new Set([...excluded, ...SENSITIVE_PROBES])].sort() };
}

async function status(base, rel) {
  const url = new URL(
    rel.split("/").map(encodeURIComponent).join("/"),
    base.endsWith("/") ? base : `${base}/`
  );
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", cache: "no-store" });
    await res.body?.cancel();
    return res.status;
  } catch (error) {
    return `error:${error.cause?.code || error.name}`;
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

export async function checkOnce(base, { required, mustNotServe }) {
  const failures = [];
  const req = await mapLimit(required, 8, (p) => status(base, p));
  required.forEach((p, i) => {
    if (req[i] !== 200) failures.push(`required path not served (${req[i]}): /${p}`);
  });
  const neg = await mapLimit(mustNotServe, 8, (p) => status(base, p));
  mustNotServe.forEach((p, i) => {
    // Any 2xx means the file is reachable. Network errors are failures too:
    // an unreachable origin proves nothing about exposure.
    if (typeof neg[i] !== "number" || (neg[i] >= 200 && neg[i] < 300)) {
      failures.push(`excluded path is reachable or unverifiable (${neg[i]}): /${p}`);
    }
  });
  return { failures, checked: required.length + mustNotServe.length };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base || !/^https?:\/\//.test(base)) {
    console.error("usage: verify-deployed.mjs <https://origin> [--retries N] [--delay-ms MS]");
    process.exit(2);
  }
  const retries = Number(arg("--retries", "1"));
  const delay = Number(arg("--delay-ms", "30000"));
  const repo = path.join(HERE, "..", "..");
  const plan = expectedPaths(trackedFiles(repo), loadConfig());

  let result;
  for (let attempt = 1; attempt <= retries; attempt++) {
    result = await checkOnce(base, plan);
    console.log(
      `attempt ${attempt}/${retries}: ${result.checked} paths checked, ${result.failures.length} failures`
    );
    if (result.failures.length === 0) break;
    if (attempt < retries) await new Promise((r) => setTimeout(r, delay));
  }
  if (result.failures.length) {
    for (const f of result.failures) console.error(`FAIL: ${f}`);
    process.exit(1);
  }
  console.log(
    `PASS: ${plan.required.length} public paths served; ${plan.mustNotServe.length} excluded paths not served by ${base}`
  );
}
