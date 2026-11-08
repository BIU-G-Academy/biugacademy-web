"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { personalIntakeOpen, provisioningMode } = require("../learning/gates");
const { callAdapter, listAdapters } = require("../cubeshackles/adapters");

describe("release gates", () => {
  it("keeps personal-data intake closed even if every reopen flag is set", () => {
    assert.equal(
      personalIntakeOpen({
        ACADEMY_PERSONAL_DATA_INTAKE: "open",
        ACADEMY_PRIVACY_ARCHITECTURE_APPROVED: "true",
        ACADEMY_COUNSEL_REVIEW_REFERENCE: "counsel-2026-11-07",
        NODE_ENV: "production",
      }),
      false
    );
  });

  it("refuses synthetic provisioning in production", () => {
    assert.equal(
      provisioningMode({
        NODE_ENV: "production",
        ACADEMY_SYNTHETIC_DEMO: "1",
        ACADEMY_ACCOUNT_PROVISIONING: "synthetic-local",
        ACADEMY_PRIVACY_ARCHITECTURE_APPROVED: "true",
        ACADEMY_COUNSEL_REVIEW_REFERENCE: "counsel-2026-11-07",
      }),
      "closed"
    );
  });

  it("allows synthetic provisioning only outside production when both flags are set", () => {
    assert.equal(
      provisioningMode({
        NODE_ENV: "test",
        ACADEMY_SYNTHETIC_DEMO: "1",
        ACADEMY_ACCOUNT_PROVISIONING: "synthetic-local",
      }),
      "synthetic-local"
    );
    assert.equal(
      provisioningMode({
        NODE_ENV: "test",
        ACADEMY_SYNTHETIC_DEMO: "1",
      }),
      "closed"
    );
  });
});

describe("CubeShackles adapters", () => {
  it("does not call the network even when a base URL is configured", async () => {
    const original = global.fetch;
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      throw new Error("network should not be used");
    };
    try {
      const result = await callAdapter("tool-api", {
        env: { CUBESHACKLES_TOOL_BASE_URL: "https://example.invalid/tools" },
        fetch: global.fetch,
      });
      assert.equal(calls, 0);
      assert.equal(result.status, 503);
      assert.equal(result.body.called, false);
      assert.equal(result.body.callable, false);
      assert.equal(result.body.ignored_base_url, true);
      assert.equal(result.body.adapter_status, "unconfigured");
    } finally {
      global.fetch = original;
    }
  });

  it("keeps SSO and the tool API non-callable", () => {
    const adapters = listAdapters();
    for (const adapter of adapters) assert.equal(adapter.callable, false);
    const sso = adapters.find((adapter) => adapter.id === "sso");
    const tool = adapters.find((adapter) => adapter.id === "tool-api");
    const notes = adapters.find((adapter) => adapter.id === "github-app-operating-notes");
    const umbrella = adapters.find((adapter) => adapter.id === "umbrella-repository");
    assert.equal(sso.status, "unconfigured");
    assert.equal(tool.status, "unconfigured");
    assert.equal(notes.status, "reference_only");
    assert.equal(notes.evidence_url, "https://github.com/CubeShackles/.github");
    assert.equal(umbrella.status, "not_accessible");
  });

  it("contains no HTTP client call in the adapter module", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "cubeshackles", "adapters.js"),
      "utf8"
    );
    assert.equal(source.includes("fetch("), false);
    assert.equal(source.includes("http.request"), false);
    assert.equal(source.includes("https.request"), false);
    assert.equal(source.includes("axios"), false);
  });
});

describe("learning schema minimization", () => {
  it("does not add personal-contact columns and is reversible outside the migrator", () => {
    const up = fs.readFileSync(
      path.join(__dirname, "..", "migrations", "004_academy_learning.sql"),
      "utf8"
    );
    const down = fs.readFileSync(
      path.join(__dirname, "..", "rollback", "004_academy_learning_down.sql"),
      "utf8"
    );
    for (const token of ["email", "phone", "whatsapp", "national", "full_name", "date_of_birth"]) {
      assert.equal(up.toLowerCase().includes(token), false, token);
    }
    assert.match(up, /age_attested_18 BOOLEAN NOT NULL/);
    assert.match(up, /academy_accounts_age_pilot CHECK \(age_attested_18 = TRUE\)/);
    for (const table of [
      "academy_accounts",
      "academy_sessions",
      "academy_cohorts",
      "academy_memberships",
      "academy_cohort_courses",
      "academy_progress",
      "academy_badges_earned",
    ]) {
      assert.match(up, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
      assert.match(down, new RegExp(`DROP TABLE IF EXISTS ${table}`));
    }
    const migrator = fs.readFileSync(path.join(__dirname, "..", "scripts", "migrate.js"), "utf8");
    assert.match(migrator, /migrations/);
    assert.equal(migrator.includes("rollback"), false);
  });
});
