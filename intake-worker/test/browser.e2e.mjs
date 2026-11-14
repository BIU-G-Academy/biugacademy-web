// Browser end-to-end test for the public site while applications are closed
// (founder directive, PR #7). Real headless Chrome against the real site pages,
// served locally. Nothing is deployed and no external host is contacted: every
// non-local request is recorded and aborted.
//
// The Worker itself is exercised in the real Workers runtime by test/e2e.test.mjs.
// This test proves the site does not send anything to it, or anywhere else.
//
// Run: CHROME_PATH="/path/to/chrome" npm run test:browser
//      (default /usr/bin/google-chrome, as on GitHub-hosted Ubuntu runners)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "..");
const ART = join(ROOT, "test", "artifacts");
const SITE_PORT = 18080;
const SITE_ORIGIN = `http://127.0.0.1:${SITE_PORT}`;

const CLOSURE = {
  pt: "As candidaturas ainda não estão abertas.",
  en: "Applications are not open yet.",
  fr: "Les candidatures ne sont pas encore ouvertes.",
};
const PRIVACY = { pt: "pt/privacidade/", en: "en/privacy/", fr: "fr/confidentialite/" };
const LANG_PREFIX = { pt: "pt-AO", en: "en-US", fr: "fr-FR" };
const FORBIDDEN_HOSTS = /formsubmit\.co|challenges\.cloudflare\.com|workers\.dev/i;
const FORM_CONTROLS = "form, input, textarea, select, [contenteditable='true']";
const MOBILE = { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const results = [];
function check(name, fn) {
  return fn().then(
    () => results.push(["PASS", name]),
    (e) => results.push(["FAIL", name, e.message])
  );
}

// Pages that carry a closure sentence, found from the tracked HTML so the list
// cannot drift from the site. Expected language comes from the sentence.
function closurePages() {
  const files = execFileSync("git", ["-C", SITE, "ls-files", "*.html"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const pages = [];
  for (const f of files) {
    const html = readFileSync(join(SITE, f), "utf8");
    const lang = Object.keys(CLOSURE).find((k) => html.includes(CLOSURE[k]));
    if (lang) pages.push({ path: f.replace(/index\.html$/, ""), lang });
  }
  return pages;
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
    const p = normalize(decodeURIComponent(new URL(req.url, SITE_ORIGIN).pathname)).replace(
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

/** Opens a page, records every request, aborts non-local ones, follows meta refresh. */
async function open(browser, path, { viewport } = {}) {
  const page = await browser.newPage();
  if (viewport) await page.setViewport(viewport);
  const requests = [];
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const url = r.url();
    requests.push({ method: r.method(), url });
    if (url.startsWith(SITE_ORIGIN) || url.startsWith("data:")) r.continue();
    else r.abort();
  });
  await page.goto(`${SITE_ORIGIN}/${path}`, { waitUntil: "load" });
  // Follow a meta refresh explicitly (read as text, then navigate) instead of
  // racing Chrome's own timer, so assertions always run on the final document.
  for (let hops = 0; hops < 3; hops++) {
    const content = await page
      .evaluate(() => document.querySelector('meta[http-equiv="refresh" i]')?.content || "")
      .catch(() => "");
    const target = /url\s*=\s*['"]?([^'";]+)/i.exec(content)?.[1];
    if (!target) break;
    await page.goto(new URL(target.trim(), page.url()).href, { waitUntil: "load" });
  }
  return { page, requests };
}

function assertNoSubmission(requests, where) {
  const writes = requests.filter((r) => r.method !== "GET");
  assert.deepEqual(writes, [], `${where}: non-GET requests ${JSON.stringify(writes)}`);
  const bad = requests.filter((r) => FORBIDDEN_HOSTS.test(r.url));
  assert.deepEqual(bad, [], `${where}: requests to intake/third-party hosts ${JSON.stringify(bad)}`);
}

const pages = closurePages();
const site = await startSite();
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const external = new Set();

try {
  await check(`B0 closure pages discovered (${pages.length}) in PT, EN and FR`, async () => {
    for (const lang of Object.keys(CLOSURE)) {
      assert.ok(pages.some((p) => p.lang === lang), `no ${lang} closure page found`);
    }
  });

  await check("B1 every closure page renders with no form controls and the closure notice in its language", async () => {
    for (const { path, lang } of pages) {
      const { page, requests } = await open(browser, path);
      const controls = await page.$$eval(FORM_CONTROLS, (els) => els.length);
      assert.equal(controls, 0, `${path}: ${controls} form controls`);
      const text = await page.evaluate(() => document.body.innerText);
      assert.ok(text.includes(CLOSURE[lang]), `${path}: closure sentence (${lang}) not visible`);
      const robots = await page.$eval('meta[name="robots"]', (m) => m.content).catch(() => "");
      assert.match(robots, /noindex/, `${path}: final page is not noindex`);
      requests.filter((r) => !r.url.startsWith(SITE_ORIGIN)).forEach((r) => external.add(new URL(r.url).host));
      await page.close();
    }
  });

  await check("B2 primary application pages declare the right language", async () => {
    for (const [lang, path] of [
      ["pt", "pt/entrar-primeira-turma/"],
      ["en", "en/waitlist/"],
      ["fr", "fr/rejoindre-premiere-cohorte/"],
      ["pt", "pt/waitlist.html"],
      ["en", "en/waitlist.html"],
      ["fr", "fr/waitlist.html"],
    ]) {
      const { page } = await open(browser, path);
      const htmlLang = await page.evaluate(() => document.documentElement.lang);
      assert.ok(htmlLang.startsWith(LANG_PREFIX[lang]), `${path}: lang="${htmlLang}"`);
      await page.close();
    }
  });

  await check("B3 clicking every button on the application pages sends nothing", async () => {
    for (const path of ["pt/entrar-primeira-turma/", "en/waitlist/", "fr/rejoindre-premiere-cohorte/", "apply/"]) {
      const { page, requests } = await open(browser, path);
      const buttons = await page.$$("button");
      for (const b of buttons) {
        if (await b.isVisible()) await b.click().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 300));
      assertNoSubmission(requests, path);
      await page.close();
    }
  });

  await check("B4 privacy pages: right language, contact route, no form controls, linked from the application page", async () => {
    const apply = { pt: "pt/entrar-primeira-turma/", en: "en/waitlist/", fr: "fr/rejoindre-premiere-cohorte/" };
    for (const [lang, path] of Object.entries(PRIVACY)) {
      const { page, requests } = await open(browser, path);
      assert.ok((await page.evaluate(() => document.documentElement.lang)).startsWith(LANG_PREFIX[lang]));
      assert.equal(await page.$$eval(FORM_CONTROLS, (els) => els.length), 0, `${path}: form controls`);
      assert.ok(await page.$('a[href="mailto:support@biugacademy.org"]'), `${path}: no mailto contact`);
      assertNoSubmission(requests, path);
      await page.close();

      const from = await open(browser, apply[lang]);
      const link = await from.page.$(`a[href="/${path}"]`);
      assert.ok(link, `${apply[lang]}: no link to /${path}`);
      await Promise.all([from.page.waitForNavigation({ waitUntil: "load" }), link.click()]);
      assert.equal(new URL(from.page.url()).pathname, `/${path}`);
      await from.page.close();
    }
  });

  await check("B5 site HTML references no intake wiring (Turnstile, intake form, API base)", async () => {
    for (const { path } of pages) {
      const { page, requests } = await open(browser, path);
      const html = await page.content();
      assert.doesNotMatch(html, /data-intake-form|cf-turnstile|biug-api-base|BIUG_API_BASE|formsubmit/i, path);
      assertNoSubmission(requests, path);
      await page.close();
    }
  });

  await check("B6 mobile 360px: no horizontal overflow on application and privacy pages", async () => {
    for (const path of ["pt/entrar-primeira-turma/", "en/waitlist/", "fr/rejoindre-premiere-cohorte/", "apply/", ...Object.values(PRIVACY)]) {
      const { page } = await open(browser, path, { viewport: MOBILE });
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      assert.ok(scroll <= client + 1, `${path}: scrollWidth ${scroll} > clientWidth ${client}`);
      if (path === "pt/entrar-primeira-turma/" || path === "pt/privacidade/") {
        await page.screenshot({ path: join(ART, `mobile-${path.replace(/\/$/, "").replace(/\//g, "_")}.png`), fullPage: true });
      }
      await page.close();
    }
  });
} finally {
  await browser.close();
  site.close();
}

const lines = results.map((r) => r.join(" | "));
lines.push(`external hosts requested (aborted): ${[...external].sort().join(", ") || "none"}`);
const out = lines.join("\n");
writeFileSync(join(ART, "browser-results.txt"), out + "\n");
console.log(out);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
