#!/usr/bin/env node
/**
 * Builds the public GitHub Pages artifact from an explicit allowlist.
 *
 *   node scripts/site/build-site.mjs [--repo <dir>] [--out <dir>] [--config <file>]
 *
 * 1. Lists git-tracked files only (untracked files such as a local .env can
 *    never be published).
 * 2. Copies files that match the allowlist in scripts/site/public-site.json.
 * 3. Verifies the result: required files present, nothing forbidden by path,
 *    name or content, and every internal link resolves inside the artifact.
 *
 * Exits non-zero on any violation. No dependencies beyond Node 22.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEXT_EXT = new Set([".html", ".css", ".js", ".svg", ".webmanifest", ".txt", ".xml"]);

export function loadConfig(file = path.join(HERE, "public-site.json")) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function trackedFiles(repo) {
  const out = execFileSync("git", ["-C", repo, "ls-files", "-z"], { encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

/** Reasons a relative path may never be public, or [] if none. */
export function forbiddenReasons(rel, config) {
  const reasons = [];
  const parts = toPosix(rel).split("/");
  const name = parts[parts.length - 1];
  for (const seg of parts.slice(0, -1)) {
    if (config.forbiddenSegments.includes(seg)) reasons.push(`forbidden directory "${seg}"`);
  }
  if (config.forbiddenSegments.includes(name)) reasons.push(`forbidden name "${name}"`);
  if (!(config.forbiddenNameExceptions || []).includes(name)) {
    for (const pattern of config.forbiddenNamePatterns) {
      if (new RegExp(pattern, "i").test(name)) reasons.push(`forbidden file name (${pattern})`);
    }
  }
  return reasons;
}

/** True when the allowlist publishes this tracked path. */
export function isAllowed(rel, config) {
  const posix = toPosix(rel);
  if (forbiddenReasons(posix, config).length) return false;
  if (config.rootFiles.includes(posix)) return true;
  const [top] = posix.split("/");
  if (!posix.includes("/") || !config.directories.includes(top)) return false;
  return config.extensions.includes(path.extname(posix).toLowerCase());
}

export function selectFiles(files, config) {
  return files.filter((f) => isAllowed(f, config)).sort();
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(toPosix(path.relative(base, full)));
  }
  return out.sort();
}

function linkTargets(html) {
  const targets = [];
  const re = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) targets.push(m[1]);
  return targets;
}

function isExternal(url) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url) || url.trim() === "";
}

function resolvesInArtifact(fromRel, url, present) {
  const clean = decodeURI(url.split("#")[0].split("?")[0]);
  if (!clean) return true;
  const target = clean.startsWith("/")
    ? clean.slice(1)
    : toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), clean)));
  if (target.startsWith("..")) return false;
  const t = target.replace(/\/$/, "");
  return (
    present.has(t) ||
    present.has(t === "" ? "index.html" : `${t}/index.html`) ||
    present.has(`${t}.html`)
  );
}

/** Verifies a built artifact directory. Returns a list of violations. */
export function verifyArtifact(outDir, config) {
  const violations = [];
  const files = walk(outDir);
  const present = new Set(files);

  for (const req of config.required) {
    const isDir = !path.extname(req) && req !== "CNAME";
    const ok = isDir ? files.some((f) => f.startsWith(`${req}/`)) : present.has(req);
    if (!ok) violations.push(`required ${isDir ? "directory" : "file"} missing: ${req}`);
  }

  const contentPatterns = config.forbiddenContentPatterns.map((p) => new RegExp(p));
  for (const rel of files) {
    for (const reason of forbiddenReasons(rel, config)) violations.push(`${rel}: ${reason}`);
    if (!isAllowed(rel, config)) violations.push(`${rel}: not on the allowlist`);
    if (TEXT_EXT.has(path.extname(rel).toLowerCase())) {
      const text = fs.readFileSync(path.join(outDir, rel), "utf8");
      for (const re of contentPatterns) {
        if (re.test(text)) violations.push(`${rel}: content matches secret pattern ${re.source}`);
      }
      if (rel.endsWith(".html")) {
        for (const url of linkTargets(text)) {
          if (isExternal(url)) continue;
          if (!resolvesInArtifact(rel, url, present)) {
            violations.push(`${rel}: internal link does not resolve in artifact: ${url}`);
          }
        }
      }
    }
  }
  return violations;
}

export function buildSite({ repo, out, config }) {
  const selected = selectFiles(trackedFiles(repo), config);
  fs.rmSync(out, { recursive: true, force: true });
  for (const rel of selected) {
    const dest = path.join(out, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(repo, rel), dest);
  }
  return { selected, violations: verifyArtifact(out, config) };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = path.resolve(arg("--repo", path.join(HERE, "..", "..")));
  const out = path.resolve(arg("--out", path.join(repo, "_site")));
  const config = loadConfig(arg("--config", undefined));
  const { selected, violations } = buildSite({ repo, out, config });
  console.log(`Published ${selected.length} allowlisted files to ${out}`);
  if (violations.length) {
    for (const v of violations) console.error(`VIOLATION: ${v}`);
    process.exit(1);
  }
  console.log("Artifact verification passed.");
}
