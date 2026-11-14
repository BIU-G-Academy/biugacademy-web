"use strict";

// Runs the full learning suite (test/learning.test.js) against the PostgreSQL
// store, the code path production uses, on a disposable database. Without
// DATABASE_URL the suite is skipped, never passed; REQUIRE_DATABASE_TESTS=1
// (CI) turns a missing database into a failure.

const { describe, before } = require("node:test");

const DB_SKIP = process.env.DATABASE_URL ? false : "DATABASE_URL is not set";
if (DB_SKIP && process.env.REQUIRE_DATABASE_TESTS === "1") {
  throw new Error("REQUIRE_DATABASE_TESTS=1 but DATABASE_URL is not set");
}

describe("learning suite on the PostgreSQL store", { skip: DB_SKIP }, () => {
  process.env.LEARNING_TEST_STORE = "pg";
  before(async () => {
    const { getPool } = require("../db");
    const { applyPendingMigrations } = require("../scripts/migrate");
    await applyPendingMigrations(getPool(), { log: () => {} });
  });
  require("./learning.test.js");
});
