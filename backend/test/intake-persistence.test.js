"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

// The API suite needs a disposable PostgreSQL database. Without DATABASE_URL
// the suite is reported as skipped, never as passed. There is deliberately no
// fallback connection string in this file.
const DB_SKIP = process.env.DATABASE_URL ? false : "DATABASE_URL is not set";
if (DB_SKIP && process.env.REQUIRE_DATABASE_TESTS === "1") {
  // CI sets REQUIRE_DATABASE_TESTS=1 so a missing database fails the job
  // instead of silently skipping the API suite.
  throw new Error("REQUIRE_DATABASE_TESTS=1 but DATABASE_URL is not set");
}

delete process.env.OPENAI_API_KEY;
delete process.env.RESEND_API_KEY;

// Personal-data intake is hard-closed in production code (learning/gates.js:
// personalIntakeOpen always returns false, and no environment variable can
// change that). These tests cover the persistence path that a future,
// approved reopening will use (consent, duplicates, no fabricated data), so
// the gate is opened HERE ONLY, by replacing the gates module in this test
// process's require cache before server.js loads. test/api.test.js asserts
// that the real gate keeps both endpoints closed.
const gatesPath = require.resolve("../learning/gates");
const realGates = require(gatesPath);
require.cache[gatesPath].exports = { ...realGates, personalIntakeOpen: () => true };

const { app } = require("../server");

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Unique per call so the suite can be re-run against the same disposable database.
let phoneSeq = 0;
function uniquePhone() {
  phoneSeq += 1;
  return `+2449${String(Date.now()).slice(-6)}${String(phoneSeq).padStart(2, "0")}`;
}

function fullPayload() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    full_name: "Consent Check",
    email: `consent-${stamp}@example.com`,
    phone_number: uniquePhone(),
    province: "Luanda",
    municipality: "Luanda",
    age_range: "25-34",
    primary_language: "Portuguese",
    education_level: "Secondary",
    areas_of_interest: ["digital-skills"],
    technical_background: "Beginner",
    internet_access_level: "Mobile data only",
    device_access: "Smartphone only",
    employment_status: "Seeking employment",
    motivation_statement: "I want to build practical digital skills for local work.",
    consent_checkbox: true,
  };
}

let server;

before(async () => {
  if (DB_SKIP) return;
  const { getPool } = require("../db");
  const { applyPendingMigrations } = require("../scripts/migrate");
  await applyPendingMigrations(getPool(), { log: () => {} });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
});

after(async () => {
  if (DB_SKIP) return;
  if (server) server.close();
  const { getPool } = require("../db");
  try {
    await getPool().end();
  } catch {
    /* ignore */
  }
});

describe("GET /api/health (intake persistence harness)", { skip: DB_SKIP }, () => {
  it("returns ok: true", async () => {
    const res = await request("GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.service, "biug-academy-intake-api");
    assert.equal(res.body.status, "healthy");
  });
});

describe("POST /api/waitlist persistence path (gate opened in test only)", { skip: DB_SKIP }, () => {
  it("returns 400 on empty body", async () => {
    const res = await request("POST", "/api/waitlist", {});
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it("returns 201 for valid intake payload", async () => {
    const payload = {
      full_name: "Test Applicant",
      email: "test-" + Date.now() + "@example.com",
      phone_number: uniquePhone(),
      whatsapp_number: "",
      province: "Luanda",
      municipality: "Luanda",
      age_range: "25-34",
      primary_language: "Portuguese",
      education_level: "Secondary",
      areas_of_interest: ["financial-literacy", "digital-skills"],
      technical_background: "Basic digital tools and customer support",
      internet_access_level: "Mobile data only",
      device_access: "Smartphone only",
      employment_status: "Informal worker",
      linkedin_optional: "",
      github_optional: "",
      motivation_statement:
        "I want to improve my practical skills to grow income opportunities and support my family.",
      consent_checkbox: true,
      source_platform: "biugacademy-web",
      browser_language: "pt-AO",
      timezone: "Africa/Luanda",
      referral_source: "website-home",
      submission_timestamp: new Date().toISOString(),
      honeypot: "",
    };

    const res = await request("POST", "/api/waitlist", payload);

    assert.equal(
      res.status,
      201,
      `Expected 201 but got ${res.status}: ${JSON.stringify(res.body)}`
    );
    assert.equal(res.body.ok, true);
    assert.ok(res.body.applicant_id, "applicant_id must be present");
    assert.equal(res.body.status, "received");
  });

  it("returns 409 for duplicate email or phone", async () => {
    const payload = {
      full_name: "Duplicate Applicant",
      email: "duplicate-" + Date.now() + "@example.com",
      phone_number: uniquePhone(),
      whatsapp_number: "",
      province: "Luanda",
      municipality: "Belas",
      age_range: "25-34",
      primary_language: "Portuguese",
      education_level: "Secondary",
      areas_of_interest: ["digital-skills"],
      technical_background: "Beginner",
      internet_access_level: "Mobile data only",
      device_access: "Smartphone only",
      employment_status: "Seeking employment",
      linkedin_optional: "",
      github_optional: "",
      motivation_statement:
        "I want to join this cohort and improve practical capabilities for the local economy.",
      consent_checkbox: true,
      source_platform: "biugacademy-web",
      browser_language: "pt-AO",
      timezone: "Africa/Luanda",
      referral_source: "website",
      submission_timestamp: new Date().toISOString(),
      honeypot: "",
    };

    const first = await request("POST", "/api/waitlist", payload);
    assert.equal(first.status, 201);

    const second = await request("POST", "/api/waitlist", payload);
    assert.equal(second.status, 409);
    assert.equal(second.body.success, false);
    assert.equal(
      second.body.applicant_id,
      undefined,
      "a duplicate response must not disclose the existing applicant identifier"
    );
    assert.doesNotMatch(JSON.stringify(second.body), /[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it("rejects a full payload whose consent is not explicitly true", async () => {
    for (const consent of [false, "false", "", undefined]) {
      const res = await request("POST", "/api/waitlist", {
        ...fullPayload(),
        consent_checkbox: consent,
      });
      assert.equal(res.status, 400, `consent=${JSON.stringify(consent)} must be rejected`);
    }
  });

  it("rejects a simplified payload that does not carry consent", async () => {
    const name = `Simplified No Consent ${Date.now()}`;
    const res = await request("POST", "/api/waitlist", {
      full_name: name,
      contact: `no-consent-${Date.now()}@example.com`,
      interest: "digital",
      motivation: "I want to learn practical digital skills for work in Luanda.",
    });
    assert.equal(res.status, 400);
    const pool = require("../db").getPool();
    const stored = await pool.query("SELECT 1 FROM waitlist_applications WHERE full_name = $1", [
      name,
    ]);
    assert.equal(stored.rowCount, 0, "nothing may be stored without explicit consent");
  });

  it("does not fabricate contact data or applicant attributes for simplified payloads", async () => {
    const stamp = Date.now();
    const make = (n) => ({
      full_name: `Simplified Email ${stamp}-${n}`,
      contact: `simplified-${stamp}-${n}@example.com`,
      interest: "digital",
      motivation: "I want to learn practical digital skills for work in Luanda.",
      consent: true,
    });

    // Two different email-only applicants must not collide on a shared placeholder phone.
    const a = await request("POST", "/api/waitlist", make(1));
    const b = await request("POST", "/api/waitlist", make(2));
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(b.status, 201, JSON.stringify(b.body));

    const pool = require("../db").getPool();
    const { rows } = await pool.query(
      `SELECT email, phone_number, age_range, province, primary_language, consent_checkbox
         FROM waitlist_applications WHERE id = $1`,
      [a.body.applicant_id]
    );
    assert.equal(rows[0].email, `simplified-${stamp}-1@example.com`);
    assert.equal(rows[0].phone_number, "", "no placeholder phone number");
    assert.equal(rows[0].age_range, "Not specified");
    assert.equal(rows[0].province, "Not specified");
    assert.equal(rows[0].primary_language, "Not specified");
    assert.equal(rows[0].consent_checkbox, true);
  });

  it("silently accepts honeypot spam payload", async () => {
    const res = await request("POST", "/api/waitlist", {
      honeypot: "bot-filled",
    });
    assert.equal(res.status, 202);
    assert.equal(res.body.ok, true);
  });
});
