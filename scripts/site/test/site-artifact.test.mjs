import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSite,
  forbiddenReasons,
  isAllowed,
  loadConfig,
  trackedFiles,
  verifyArtifact,
} from "../build-site.mjs";
import { checkOnce, expectedPaths, SENSITIVE_PROBES } from "../verify-deployed.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const config = loadConfig();
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `biug-site-${name}-`));

describe("allowlist rules", () => {
  it("publishes public pages and assets", () => {
    for (const p of [
      "index.html",
      "CNAME",
      "pt/index.html",
      "en/waitlist/index.html",
      "fr/index.html",
      "css/styles.css",
      "js/script.js",
      "portal/portal.css",
      "assets/logo.png",
    ]) {
      assert.equal(isAllowed(p, config), true, p);
    }
  });

  it("never publishes server code, migrations, configuration, internal docs, tests or secrets", () => {
    for (const p of [
      "backend/server.js",
      "backend/.env.example",
      "backend/.env",
      "backend/migrations/001_create_waitlist_applications.sql",
      "backend/test/api.test.js",
      "google-apps-script/Code.gs",
      "intake-worker/src/index.js",
      "docs/README.md",
      "templates/README.md",
      "scripts/site/build-site.mjs",
      ".github/workflows/pages.yml",
      "AGENTS.md",
      "README.md",
      "CODEOWNERS",
      "LICENSE",
      ".env",
      ".gitignore",
      // Inside an allowed directory, but with a forbidden name or extension:
      "js/test/helpers.js",
      "pt/notes.md",
      "css/.env",
      "assets/config.json",
      "en/dump.sql",
      "portal/migrations/x.html",
      "assets/server.key",
    ]) {
      assert.equal(isAllowed(p, config), false, p);
    }
  });

  it("explains why a path is forbidden", () => {
    assert.ok(forbiddenReasons("backend/server.js", config).some((r) => r.includes("backend")));
    assert.ok(forbiddenReasons("pt/x.sql", config).length > 0);
    assert.deepEqual(forbiddenReasons("pt/index.html", config), []);
  });
});

describe("artifact built from this repository", () => {
  let out;
  let result;
  before(() => {
    out = tmp("repo");
    result = buildSite({ repo: REPO, out, config });
  });
  after(() => fs.rmSync(out, { recursive: true, force: true }));

  it("passes verification (required files, no forbidden content, internal links resolve)", () => {
    assert.deepEqual(result.violations, []);
  });

  it("contains every tracked public HTML page", () => {
    const pages = trackedFiles(REPO).filter(
      (f) => f.endsWith(".html") && !forbiddenReasons(f, config).length
    );
    for (const page of pages) assert.ok(fs.existsSync(path.join(out, page)), page);
  });

  it("contains no tracked file that the allowlist excludes", () => {
    const excluded = trackedFiles(REPO).filter((f) => !isAllowed(f, config));
    assert.ok(excluded.length > 0);
    for (const f of excluded) assert.equal(fs.existsSync(path.join(out, f)), false, f);
    for (const dir of [
      "backend",
      "docs",
      "google-apps-script",
      "templates",
      "scripts",
      ".github",
    ]) {
      assert.equal(fs.existsSync(path.join(out, dir)), false, dir);
    }
  });
});

describe("verification guard", () => {
  it("rejects an artifact with an injected forbidden file, secret or broken link", () => {
    const out = tmp("inject");
    buildSite({ repo: REPO, out, config });
    fs.mkdirSync(path.join(out, "backend"), { recursive: true });
    fs.writeFileSync(path.join(out, "backend", "server.js"), "x");
    fs.writeFileSync(
      path.join(out, "pt", "leak.html"),
      'postgresql://user:pw@db/x <a href="/nope/">'
    );
    const v = verifyArtifact(out, config);
    fs.rmSync(out, { recursive: true, force: true });
    assert.ok(v.some((x) => x.startsWith("backend/server.js")));
    assert.ok(v.some((x) => x.includes("secret pattern")));
    assert.ok(v.some((x) => x.includes("does not resolve")));
  });

  it("reports a missing required file", () => {
    const out = tmp("missing");
    buildSite({ repo: REPO, out, config });
    fs.rmSync(path.join(out, "CNAME"));
    const v = verifyArtifact(out, config);
    fs.rmSync(out, { recursive: true, force: true });
    assert.ok(v.includes("required file missing: CNAME"));
  });

  it("publishes tracked files only, never untracked local files", () => {
    const repo = tmp("fixture");
    const run = (...a) => execFileSync("git", ["-C", repo, ...a], { stdio: "ignore" });
    run("init", "-q");
    for (const f of [...config.required.filter((r) => r !== "assets"), "assets/a.png"]) {
      fs.mkdirSync(path.join(repo, path.dirname(f)), { recursive: true });
      fs.writeFileSync(path.join(repo, f), "<p>ok</p>");
    }
    run("add", "-A");
    fs.writeFileSync(path.join(repo, "css", "untracked.css"), "body{}");
    const out = tmp("fixture-out");
    const { selected, violations } = buildSite({ repo, out, config });
    assert.deepEqual(violations, []);
    assert.equal(selected.includes("css/untracked.css"), false);
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { recursive: true, force: true });
  });
});

describe("deployed-domain verifier", () => {
  const files = trackedFiles(REPO);
  const plan = expectedPaths(files, config);

  function serve(handler) {
    return new Promise((resolve) => {
      const server = http.createServer(handler).listen(0, "127.0.0.1", () => resolve(server));
    });
  }

  it("plans negative checks for every excluded tracked file and sensitive probes", () => {
    assert.ok(plan.mustNotServe.includes("backend/server.js"));
    assert.ok(plan.mustNotServe.includes("AGENTS.md"));
    for (const probe of SENSITIVE_PROBES) assert.ok(plan.mustNotServe.includes(probe));
    assert.ok(plan.required.includes("pt/index.html"));
  });

  it("passes against an origin that serves only the artifact", async () => {
    const out = tmp("serve");
    buildSite({ repo: REPO, out, config });
    const server = await serve((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "");
      const file = path.join(out, rel);
      if (rel && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200).end(fs.readFileSync(file));
      } else res.writeHead(404).end();
    });
    const { failures } = await checkOnce(`http://127.0.0.1:${server.address().port}`, plan);
    server.close();
    fs.rmSync(out, { recursive: true, force: true });
    assert.deepEqual(failures, []);
  });

  it("fails against an origin that serves the whole repository (the pre-cutover state)", async () => {
    const server = await serve((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "");
      if (files.includes(rel)) res.writeHead(200).end("x");
      else res.writeHead(404).end();
    });
    const { failures } = await checkOnce(`http://127.0.0.1:${server.address().port}`, plan);
    server.close();
    assert.ok(failures.some((f) => f.includes("/backend/server.js")));
    assert.ok(failures.some((f) => f.includes("/AGENTS.md")));
  });

  it("treats an unreachable origin as a failure, not a pass", async () => {
    const { failures } = await checkOnce("http://127.0.0.1:9", {
      required: [],
      mustNotServe: ["backend/server.js"],
    });
    assert.equal(failures.length, 1);
  });
});
