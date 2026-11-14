#!/usr/bin/env node
/**
 * Checks that relative links in tracked Markdown files resolve to tracked
 * files or directories. External URLs (http, https, mailto) and pure anchors
 * are not checked here: they are network-dependent and would make a required
 * check flaky.
 *
 *   node scripts/ci/check-md-links.mjs [--repo <dir>]
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_PREFIX = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

export function extractLinks(markdown) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const links = [];
  const inline = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  const reference = /^\s*\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+"[^"]*")?\s*$/gm;
  for (const re of [inline, reference]) {
    let m;
    while ((m = re.exec(withoutCode))) links.push(m[1]);
  }
  return links;
}

export function brokenLinks(repo, files) {
  const tracked = new Set(files);
  const dirs = new Set();
  for (const f of files) {
    const parts = f.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
  }
  const broken = [];
  for (const file of files.filter((f) => f.endsWith(".md"))) {
    const text = fs.readFileSync(path.join(repo, file), "utf8");
    for (const link of extractLinks(text)) {
      if (SKIP_PREFIX.test(link)) continue;
      let target = decodeURI(link.split("#")[0].split("?")[0]);
      if (!target) continue;
      target = target.startsWith("/")
        ? target.slice(1)
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      target = target.replace(/\/$/, "");
      if (target === "" || target === ".") continue;
      if (!tracked.has(target) && !dirs.has(target)) broken.push(`${file}: ${link}`);
    }
  }
  return broken;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--repo");
  const repo = path.resolve(i === -1 ? "." : process.argv[i + 1]);
  const files = execFileSync("git", ["-C", repo, "ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  const broken = brokenLinks(repo, files);
  for (const b of broken) console.error(`BROKEN: ${b}`);
  console.log(`${files.filter((f) => f.endsWith(".md")).length} Markdown files, ${broken.length} broken relative links`);
  process.exit(broken.length ? 1 : 0);
}
