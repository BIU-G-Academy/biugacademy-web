// Browser end-to-end test: the real site pages (served locally) + real Turnstile widget
// (Cloudflare TEST site key) + the Worker in workerd with a local D1. Headless Chrome.
// Nothing is deployed. Run: CHROME_PATH=/usr/bin/google-chrome npm run test:browser
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  createWriteStream,
  readFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "..");
const ART = join(ROOT, "test", "artifacts");
const SITE_PORT = 18080;
const SITE_ORIGIN = `http://127.0.0.1:${SITE_PORT}`;
const ADMIN = "browser-admin-token-" + "y".repeat(40);
const SITEKEY_PASS = "1x00000000000000000000AA"; // Turnstile test site key: always passes
const KEY = (n) => Buffer.alloc(32, n).toString("base64");
const procs = [];
const results = [];

function check(name, fn) {
  return fn().then(
    () => results.push(["PASS", name]),
    (e) => {
      results.push(["FAIL", name, e.message]);
    }
  );
}

async function startWorker(name, port, secret) {
  const dir = mkdtempSync(join(tmpdir(), "biug-browser-" + name + "-"));
  const envFile = join(dir, "test.env");
  writeFileSync(
    envFile,
    [
      "ENVIRONMENT=local",
      `ALLOWED_ORIGINS=${SITE_ORIGIN},https://biugacademy.org`,
      "TURNSTILE_EXPECTED_HOSTNAMES=",
      `TURNSTILE_SECRET=${secret}`,
      `DATA_KEY=${KEY(3)}`,
      `HASH_KEY=${KEY(4)}`,
      `ADMIN_TOKEN=${ADMIN}`,
      "RATE_LIMIT_PER_HOUR=50",
    ].join("\n")
  );
  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "biug-academy-intake",
      "--local",
      "--persist-to",
      dir,
    ],
    { cwd: ROOT, stdio: "pipe" }
  );
  const log = createWriteStream(join(ART, `wrangler-browser-${name}.log`));
  const p = spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--local-protocol",
      "https",
      "--persist-to",
      dir,
      "--env-file",
      envFile,
      "--show-interactive-dev-session=false",
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true }
  );
  p.stdout.pipe(log);
  p.stderr.pipe(log);
  procs.push(p);
  const base = `https://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base + "/api/health", { signal: AbortSignal.timeout(2000) })).ok)
        return base;
    } catch (_e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("worker did not start");
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
function startSite() {
  const srv = createServer((req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, SITE_ORIGIN).pathname)).replace(
      /^(\.\.[/\\])+/,
      ""
    );
    let f = join(SITE, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream" });
    res.end(readFileSync(f));
  });
  return new Promise((r) => srv.listen(SITE_PORT, "127.0.0.1", () => r(srv)));
}

async function fillApplication(page, over = {}) {
  const v = {
    full_name: "Browser Teste",
    email: "browser.teste@example.com",
    phone: "923111222",
    province: "Benguela",
    age: "25-34",
    language: "Umbundu",
    education: "Technical",
    consent: true,
    ...over,
  };
  await page.type("#full_name", v.full_name);
  if (v.email) await page.type("#email", v.email);
  if (v.phone) await page.type("#phone_number", v.phone);
  await page.select("#province", v.province);
  await page.select("#age_range", v.age);
  await page.select("#primary_language", v.language);
  await page.select("#education_level", v.education);
  await page.click('input[name="areas_of_interest"][value="digital-skills"]');
  if (v.consent) await page.click('input[name="consent_privacy"]');
}

async function withConfig(page, apiBase) {
  await page.evaluateOnNewDocument(
    (api, key) => {
      window.BIUG_API_BASE = api;
      window.BIUG_TURNSTILE_SITEKEY = key;
    },
    apiBase,
    SITEKEY_PASS
  );
}

async function waitForToken(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return el && el.value && el.value.length > 10;
    },
    { timeout: 30000 }
  );
}

const site = await startSite();
const good = await startWorker("pass", 18794, "1x0000000000000000000000000000000AA");
const bad = await startWorker("fail", 18795, "2x0000000000000000000000000000000AA");
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--ignore-certificate-errors"],
  acceptInsecureCerts: true,
});

try {
  await check("B1 fail-closed when intake is not configured: nothing is sent", async () => {
    const page = await browser.newPage();
    const posts = [];
    page.on("request", (r) => r.method() === "POST" && posts.push(r.url()));
    await page.goto(SITE_ORIGIN + "/pt/entrar-primeira-turma/", { waitUntil: "networkidle0" });
    await fillApplication(page);
    await page.click('button[type="submit"]');
    await page.waitForSelector(".form-message.is-visible.error");
    const msg = await page.$eval(".form-message", (e) => e.textContent);
    assert.match(msg, /ainda não está ativo/);
    assert.deepEqual(posts, []);
    await page.screenshot({ path: join(ART, "b1-fail-closed.png"), fullPage: true });
    await page.close();
  });

  await check(
    "B2 happy path (PT): Turnstile token, POST to Worker, redirect, row stored",
    async () => {
      const page = await browser.newPage();
      await withConfig(page, good);
      await page.goto(SITE_ORIGIN + "/pt/entrar-primeira-turma/", { waitUntil: "networkidle0" });
      await waitForToken(page);
      await fillApplication(page);
      await page.screenshot({ path: join(ART, "b2-filled.png"), fullPage: true });
      await Promise.all([
        page.waitForNavigation({ timeout: 20000 }),
        page.click('button[type="submit"]'),
      ]);
      assert.equal(new URL(page.url()).pathname, "/pt/candidatura-recebida/");
      const exp = await (
        await fetch(good + "/admin/applications", { headers: { Authorization: "Bearer " + ADMIN } })
      ).json();
      const rec = exp.applications.find((a) => a.email === "browser.teste@example.com");
      assert.ok(rec, "application stored");
      assert.equal(rec.phone, "+244923111222");
      assert.equal(rec.primary_language, "Umbundu");
      assert.equal(rec.referral_source, "direct");
      await page.close();
    }
  );

  await check("B3 client-side: no contact -> message, no POST", async () => {
    const page = await browser.newPage();
    await withConfig(page, good);
    const posts = [];
    page.on(
      "request",
      (r) => r.method() === "POST" && r.url().startsWith(good) && posts.push(r.url())
    );
    await page.goto(SITE_ORIGIN + "/en/waitlist/", { waitUntil: "networkidle0" });
    await waitForToken(page);
    await fillApplication(page, { email: "", phone: "" });
    await page.click('button[type="submit"]');
    await page.waitForSelector(".form-message.is-visible.error");
    assert.match(await page.$eval(".form-message", (e) => e.textContent), /at least one contact/);
    assert.deepEqual(posts, []);
    await page.close();
  });

  await check("B4 minor: guardian checkbox appears and is required", async () => {
    const page = await browser.newPage();
    await withConfig(page, good);
    await page.goto(SITE_ORIGIN + "/fr/rejoindre-premiere-cohorte/", { waitUntil: "networkidle0" });
    await waitForToken(page);
    assert.equal(await page.$eval('[data-field="guardian_consent"]', (e) => e.hidden), true);
    await fillApplication(page, {
      email: "mineur@example.com",
      phone: "",
      age: "16-17",
      language: "French",
    });
    assert.equal(await page.$eval('[data-field="guardian_consent"]', (e) => e.hidden), false);
    assert.equal(await page.$eval('input[name="guardian_consent"]', (e) => e.required), true);
    await page.close();
  });

  await check(
    "B5 server rejection (Turnstile fails server-side) shows error, stays on page",
    async () => {
      const page = await browser.newPage();
      await withConfig(page, bad);
      await page.goto(SITE_ORIGIN + "/pt/entrar-primeira-turma/", { waitUntil: "networkidle0" });
      await waitForToken(page);
      await fillApplication(page, { email: "rejeitado@example.com" });
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () =>
          /verificação anti-robô falhou/.test(document.querySelector(".form-message").textContent),
        { timeout: 20000 }
      );
      assert.equal(new URL(page.url()).pathname, "/pt/entrar-primeira-turma/");
      await page.screenshot({ path: join(ART, "b5-server-rejected.png"), fullPage: true });
      await page.close();
    }
  );

  await check("B6 privacy page: deletion request accepted with reference", async () => {
    const page = await browser.newPage();
    await withConfig(page, good);
    await page.goto(SITE_ORIGIN + "/pt/privacidade/", { waitUntil: "networkidle0" });
    await waitForToken(page);
    await page.type("#pr-email", "browser.teste@example.com");
    await page.click('form[data-intake-form="privacy"] button[type="submit"]');
    await page.waitForFunction(
      () =>
        /Referência: PRV-/.test(
          document.querySelector('form[data-intake-form="privacy"] .form-message').textContent
        ),
      { timeout: 20000 }
    );
    const list = await (
      await fetch(good + "/admin/privacy-requests", {
        headers: { Authorization: "Bearer " + ADMIN },
      })
    ).json();
    assert.equal(list.requests.at(-1).matching_applications, 1);
    await page.screenshot({ path: join(ART, "b6-privacy-request.png"), fullPage: true });
    await page.close();
  });

  await check("B7 legacy FormSubmit pages now redirect (no third-party form left)", async () => {
    for (const f of ["pt/waitlist.html", "en/waitlist.html", "fr/waitlist.html"]) {
      const html = readFileSync(join(SITE, f), "utf8");
      assert.ok(html.includes('http-equiv="refresh"'), f);
      assert.ok(!html.includes("formsubmit.co"), f);
    }
    let hits = "";
    try {
      hits = execFileSync(
        "grep",
        [
          "-rl",
          "--include=*.html",
          "--include=*.js",
          "--exclude-dir=node_modules",
          "--exclude-dir=intake-worker",
          "--exclude-dir=.git",
          "formsubmit.co",
          SITE,
        ],
        { encoding: "utf8" }
      ).trim();
    } catch (e) {
      if (e.status !== 1) throw e; // grep exit 1 = no matches
    }
    assert.equal(hits, "", "pages still posting to FormSubmit: " + hits);
  });
} finally {
  await browser.close();
  site.close();
  for (const p of procs) {
    try {
      process.kill(-p.pid, "SIGTERM");
    } catch (_e) {}
  }
}

const out = results.map((r) => r.join(" | ")).join("\n");
writeFileSync(join(ART, "browser-results.txt"), out + "\n");
console.log(out);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
