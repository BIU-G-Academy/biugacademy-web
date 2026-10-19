// End-to-end tests against the real Workers runtime (workerd via `wrangler dev --local`)
// with a local D1 database and Cloudflare's official Turnstile TEST secret keys.
// Nothing is deployed and no Cloudflare account resources are created.
//
// Run: npm run test:e2e   (Node >= 22; needs outbound HTTPS to challenges.cloudflare.com)
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // wrangler's local HTTPS uses a self-signed cert

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ART = join(ROOT, "test", "artifacts");
const ORIGIN = "https://biugacademy.org";
const ADMIN = "test-admin-token-" + "x".repeat(40);
const TS_PASS = "1x0000000000000000000000000000000AA"; // Turnstile test secret: always passes
const TS_FAIL = "2x0000000000000000000000000000000AA"; // Turnstile test secret: always fails
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const KEY = (n) => Buffer.alloc(32, n).toString("base64");

const instances = {};

function wrangler(args, opts = {}) {
  return execFileSync("npx", ["wrangler", ...args], { cwd: ROOT, encoding: "utf8", ...opts });
}

function sql(name, command) {
  const out = wrangler([
    "d1",
    "execute",
    "biug-academy-intake",
    "--local",
    "--persist-to",
    instances[name].dir,
    "--json",
    "--command",
    command,
  ]);
  return JSON.parse(out)[0].results;
}

async function start(name, port, protocol, vars) {
  const dir = mkdtempSync(join(tmpdir(), "biug-intake-" + name + "-"));
  const envFile = join(dir, "test.env");
  writeFileSync(
    envFile,
    Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
  wrangler(["d1", "migrations", "apply", "biug-academy-intake", "--local", "--persist-to", dir], {
    stdio: "pipe",
  });
  const log = createWriteStream(join(ART, `wrangler-${name}.log`));
  const proc = spawn(
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
      protocol,
      "--persist-to",
      dir,
      "--env-file",
      envFile,
      "--test-scheduled",
      "--show-interactive-dev-session=false",
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true }
  );
  proc.stdout.pipe(log);
  proc.stderr.pipe(log);
  const base = `${protocol}://127.0.0.1:${port}`;
  instances[name] = { proc, dir, base };
  let exited = false;
  proc.on("exit", () => (exited = true));
  for (let i = 0; i < 120; i++) {
    if (exited) throw new Error("wrangler dev exited early: " + name + " (see test/artifacts)");
    try {
      const r = await fetch(base + "/api/health", { signal: AbortSignal.timeout(2000) });
      if (r.status === 200) return;
    } catch (_e) {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("wrangler dev did not start: " + name);
}

const baseVars = {
  ENVIRONMENT: "local",
  ALLOWED_ORIGINS: "https://biugacademy.org,https://www.biugacademy.org",
  TURNSTILE_EXPECTED_HOSTNAMES: "",
  DATA_KEY: KEY(7),
  HASH_KEY: KEY(9),
};

before(async () => {
  // A: production-like (HTTPS, passing Turnstile test key, admin enabled)
  await start("A", 18791, "https", {
    ...baseVars,
    TURNSTILE_SECRET: TS_PASS,
    ADMIN_TOKEN: ADMIN,
    RATE_LIMIT_PER_HOUR: "100",
  });
  // B: Turnstile always fails, low rate limit, plain HTTP explicitly allowed
  await start("B", 18792, "http", {
    ...baseVars,
    TURNSTILE_SECRET: TS_FAIL,
    ALLOW_HTTP: "true",
    RATE_LIMIT_PER_HOUR: "3",
  });
  // C: plain HTTP NOT allowed, admin disabled (no token)
  await start("C", 18793, "http", { ...baseVars, TURNSTILE_SECRET: TS_PASS });
});

after(() => {
  for (const i of Object.values(instances)) {
    try {
      process.kill(-i.proc.pid, "SIGTERM");
    } catch (_e) {}
  }
});

function application(over = {}) {
  return {
    full_name: "Teste Candidato",
    email: "candidato.teste@example.com",
    phone_number: "923000111",
    phone_has_whatsapp: true,
    province: "Luanda",
    age_range: "18-24",
    primary_language: "Portuguese",
    education_level: "Secondary",
    areas_of_interest: ["digital-skills"],
    internet_access_level: "Mobile data only",
    device_access: "Smartphone only",
    consent_privacy: true,
    consent_version: "2026-10-19",
    form_language: "pt",
    "cf-turnstile-response": DUMMY_TOKEN,
    website: "",
    ...over,
  };
}

async function post(name, path, body, headers = {}) {
  const res = await fetch(instances[name].base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_e) {}
  return { status: res.status, json, text, headers: res.headers };
}

const admin = (name, path, init = {}) =>
  fetch(instances[name].base + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + ADMIN,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

const count = (name, table) => sql(name, `SELECT COUNT(*) AS n FROM ${table}`)[0].n;

// ---------- success paths ----------

test("S1 health reports configured", async () => {
  const r = await fetch(instances.A.base + "/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, service: "biug-academy-intake", configured: true });
  assert.equal(r.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
});

test("S2 valid application is stored with contact fields encrypted", async () => {
  const r = await post("A", "/api/waitlist", application({ bi_number: "000123456LA042" }));
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.ok, true);
  assert.match(r.json.reference, /^BIUG-/);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  const row = sql("A", `SELECT * FROM applications WHERE id='${r.json.reference}'`)[0];
  assert.ok(row.name_enc.startsWith("v1.") && !row.name_enc.includes("Teste"));
  assert.ok(row.email_enc.startsWith("v1.") && !row.email_enc.includes("example"));
  assert.ok(row.phone_enc.startsWith("v1."));
  assert.equal(row.province, "Luanda");
  assert.equal(row.consent_version, "2026-10-19");
  assert.equal(
    JSON.stringify(row).includes("000123456LA042"),
    false,
    "unknown field must not be stored"
  );
  const days = (new Date(row.expires_at) - new Date(row.created_at)) / 86400000;
  assert.equal(Math.round(days), 365);
  writeFileSync(join(ART, "stored-row-sample.json"), JSON.stringify(row, null, 2));
});

test("S3 duplicate contact is acknowledged but not stored twice", async () => {
  const before = count("A", "applications");
  const r = await post(
    "A",
    "/api/waitlist",
    application({ phone_number: "+244 923 000 111", email: "" })
  );
  assert.equal(r.status, 200);
  assert.equal(r.json.duplicate, true);
  assert.equal(count("A", "applications"), before);
});

test("S4 minor (16-17) accepted only with guardian consent", async () => {
  const bad = await post(
    "A",
    "/api/waitlist",
    application({ email: "menor@example.com", phone_number: "", age_range: "16-17" })
  );
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.json.fields, ["guardian_consent"]);
  const ok = await post(
    "A",
    "/api/waitlist",
    application({
      email: "menor@example.com",
      phone_number: "",
      age_range: "16-17",
      guardian_consent: true,
    })
  );
  assert.equal(ok.status, 201, ok.text);
});

test("S5 support message stored encrypted", async () => {
  const r = await post("A", "/api/support", {
    name: "Ana Teste",
    email: "ana.teste@example.com",
    message: "Preciso de ajuda com a candidatura.",
    consent_privacy: true,
    form_language: "pt",
    page_url: "https://biugacademy.org/pt/?x=1",
    "cf-turnstile-response": DUMMY_TOKEN,
  });
  assert.equal(r.status, 201, r.text);
  const row = sql("A", `SELECT * FROM support_messages WHERE id='${r.json.reference}'`)[0];
  assert.ok(!row.message_enc.includes("ajuda"));
  assert.equal(row.page_path, "/pt/");
});

test("S6 CORS preflight for allowed origin", async () => {
  const r = await fetch(instances.A.base + "/api/waitlist", {
    method: "OPTIONS",
    headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" },
  });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
});

// ---------- failure paths ----------

test("F1 missing consent rejected, nothing stored", async () => {
  const before = count("A", "applications");
  const r = await post(
    "A",
    "/api/waitlist",
    application({ email: "f1@example.com", phone_number: "", consent_privacy: false })
  );
  assert.equal(r.status, 400);
  assert.deepEqual(r.json, { ok: false, error: "validation_failed", fields: ["consent_privacy"] });
  assert.equal(count("A", "applications"), before);
});

test("F2 invalid fields rejected with field list", async () => {
  const r = await post(
    "A",
    "/api/waitlist",
    application({ email: "nope", phone_number: "abc", province: "Atlantis", areas_of_interest: [] })
  );
  assert.equal(r.status, 400);
  for (const f of ["email", "phone_number", "province", "areas_of_interest"])
    assert.ok(r.json.fields.includes(f), f);
});

test("F3 no contact channel rejected", async () => {
  const r = await post("A", "/api/waitlist", application({ email: "", phone_number: "" }));
  assert.equal(r.status, 400);
  assert.deepEqual(r.json.fields, ["contact"]);
});

test("F4 honeypot: bot gets fake success, nothing stored", async () => {
  const before = count("A", "applications");
  const r = await post(
    "A",
    "/api/waitlist",
    application({ email: "bot@example.com", phone_number: "", website: "http://spam.example" })
  );
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(count("A", "applications"), before);
});

test("F5 missing Turnstile token rejected", async () => {
  const body = application({ email: "f5@example.com", phone_number: "" });
  delete body["cf-turnstile-response"];
  const r = await post("A", "/api/waitlist", body);
  assert.equal(r.status, 403);
  assert.equal(r.json.error, "verification_failed");
});

test("F6 Turnstile siteverify failure rejected (always-fail test secret)", async () => {
  const r = await post("B", "/api/waitlist", application());
  assert.equal(r.status, 403);
  assert.equal(r.json.error, "verification_failed");
  assert.equal(count("B", "applications"), 0);
});

test("F7 foreign origin rejected (POST and preflight)", async () => {
  const r = await post("A", "/api/waitlist", application({ email: "f7@example.com" }), {
    Origin: "https://evil.example",
  });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, "origin_not_allowed");
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  const noOrigin = await fetch(instances.A.base + "/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(noOrigin.status, 403);
  const pre = await fetch(instances.A.base + "/api/waitlist", {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(pre.status, 403);
});

test("F8 wrong content type, oversize body, malformed JSON", async () => {
  const a = await post("A", "/api/waitlist", "full_name=x", {
    "Content-Type": "application/x-www-form-urlencoded",
  });
  assert.equal(a.status, 415);
  const b = await post(
    "A",
    "/api/waitlist",
    JSON.stringify(application({ technical_background: "x".repeat(9000) }))
  );
  assert.equal(b.status, 413);
  const c = await post("A", "/api/waitlist", "{not json");
  assert.equal(c.status, 400);
  assert.equal(c.json.error, "invalid_json");
});

test("F9 rate limit: 4th request in the hour gets 429", async () => {
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await post("B", "/api/support", { name: "x" })).status);
  // B has already used 1 slot in F6 (waitlist scope is separate) -> support scope: 403,403,403,429
  assert.deepEqual(codes, [403, 403, 403, 429]);
});

test("F10 plain HTTP rejected when not explicitly allowed", async () => {
  const r = await post("C", "/api/waitlist", application());
  assert.equal(r.status, 403);
  assert.equal(r.json.error, "https_required");
  assert.equal(count("C", "applications"), 0);
});

test("F11 unknown route 404, GET on POST route 404", async () => {
  assert.equal((await fetch(instances.A.base + "/api/nope")).status, 404);
  assert.equal((await fetch(instances.A.base + "/api/waitlist")).status, 404);
});

// ---------- admin access control ----------

test("A1 admin rejects missing/wrong token; disabled when no token configured", async () => {
  assert.equal((await fetch(instances.A.base + "/admin/applications")).status, 401);
  assert.equal(
    (
      await fetch(instances.A.base + "/admin/applications", {
        headers: { Authorization: "Bearer wrong" },
      })
    ).status,
    401
  );
  assert.equal(
    (
      await fetch(instances.C.base + "/admin/applications", {
        headers: { Authorization: "Bearer " + ADMIN },
      })
    ).status,
    401
  );
});

test("A2 admin export decrypts (JSON + CSV) and is audit-logged", async () => {
  const r = await admin("A", "/admin/applications");
  assert.equal(r.status, 200);
  const j = await r.json();
  const rec = j.applications.find((x) => x.email === "candidato.teste@example.com");
  assert.equal(rec.full_name, "Teste Candidato");
  assert.equal(rec.phone, "+244923000111");
  const csv = await (await admin("A", "/admin/applications?format=csv")).text();
  assert.ok(csv.split("\r\n")[0].startsWith("reference,created_at"));
  const aud = sql("A", "SELECT action, detail FROM admin_audit ORDER BY id");
  assert.ok(aud.some((a) => a.action === "export_applications"));
  assert.ok(!JSON.stringify(aud).includes("example.com"), "audit log must not hold personal data");
  const stats = await (await admin("A", "/admin/stats")).json();
  assert.ok(stats.stats.applications_total >= 2);
});

// ---------- deletion path and retention ----------

test("D1 deletion request -> admin erase -> data gone, request completed", async () => {
  const pr = await post("A", "/api/privacy-request", {
    request_type: "deletion",
    email: "Candidato.Teste@example.com",
    form_language: "pt",
    "cf-turnstile-response": DUMMY_TOKEN,
  });
  assert.equal(pr.status, 202, pr.text);
  const list = await (await admin("A", "/admin/privacy-requests")).json();
  const req = list.requests.find((x) => x.id === pr.json.reference);
  assert.equal(req.status, "pending");
  assert.equal(req.matching_applications, 1);
  const er = await admin("A", "/admin/erase", {
    method: "POST",
    body: JSON.stringify({ privacy_request_id: pr.json.reference }),
  });
  assert.equal(er.status, 200);
  assert.equal((await er.json()).records_erased, 1);
  const left = sql(
    "A",
    "SELECT COUNT(*) AS n FROM applications WHERE province='Luanda' AND age_range='18-24'"
  )[0].n;
  assert.equal(left, 0);
  const done = sql(
    "A",
    `SELECT status, records_erased, email_hash FROM privacy_requests WHERE id='${pr.json.reference}'`
  )[0];
  assert.equal(done.status, "completed");
  assert.ok(!String(done.email_hash).includes("@"));
});

test("D2 privacy request for unknown contact gets the same 202 (no enumeration)", async () => {
  const pr = await post("A", "/api/privacy-request", {
    request_type: "deletion",
    phone_number: "+244 999 999 999",
    "cf-turnstile-response": DUMMY_TOKEN,
  });
  assert.equal(pr.status, 202);
});

test("R1 retention purge deletes expired records only", async () => {
  sql(
    "A",
    "INSERT INTO applications (id, created_at, expires_at, form_language, consent_version, consent_at, name_enc, province, age_range, primary_language, education_level, areas_of_interest) VALUES ('BIUG-EXPIRED001','2025-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','pt','2026-10-19','2025-01-01T00:00:00.000Z','v1.x.y','Huambo','25-34','Umbundu','Primary','[\"digital-skills\"]')"
  );
  const before = count("A", "applications");
  const r = await admin("A", "/admin/purge", { method: "POST", body: "{}" });
  const j = await r.json();
  assert.equal(j.deleted.applications, 1);
  assert.equal(count("A", "applications"), before - 1);
});

test("R2 daily cron trigger runs the same purge", async () => {
  sql(
    "A",
    "INSERT INTO support_messages (id, created_at, expires_at, form_language, name_enc, email_enc, email_hash, message_enc) VALUES ('SUP-EXPIRED001','2025-01-01T00:00:00.000Z','2025-07-01T00:00:00.000Z','pt','v1.a.b','v1.a.b','h','v1.a.b')"
  );
  const r = await fetch(instances.A.base + "/__scheduled?cron=15+3+*+*+*");
  assert.equal(r.status, 200);
  await new Promise((res) => setTimeout(res, 1000));
  assert.equal(
    sql("A", "SELECT COUNT(*) AS n FROM support_messages WHERE id='SUP-EXPIRED001'")[0].n,
    0
  );
  assert.ok(sql("A", "SELECT actor FROM admin_audit WHERE actor='cron'").length >= 1);
});
