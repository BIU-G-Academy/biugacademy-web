"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function getAppliedMigrations(pool) {
  const { rows } = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

async function applyMigration(pool, filename, log = console.log) {
  const migrationPath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(migrationPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
    log(`Applied migration: ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`Migration failed (${filename}): ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Applies every pending migration in filename order. Each file runs in its own
 * transaction. Used by the CLI below and by the test harness, so tests run
 * against the same schema history as every other environment.
 */
async function applyPendingMigrations(pool, { log = console.log } = {}) {
  await ensureMigrationsTable(pool);
  const files = getMigrationFiles();
  const applied = await getAppliedMigrations(pool);
  const newlyApplied = [];

  for (const file of files) {
    if (applied.has(file)) {
      log(`Skipping already applied migration: ${file}`);
      continue;
    }
    await applyMigration(pool, file, log);
    newlyApplied.push(file);
  }
  return { total: files.length, applied: newlyApplied };
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required for migrations.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  try {
    console.log("Connecting to database...");
    await pool.query("SELECT 1");
    console.log("Database connection ok.");

    const result = await applyPendingMigrations(pool);
    if (result.total === 0) {
      console.log("No migration files found.");
      return;
    }

    console.log("Migrations completed successfully.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { applyPendingMigrations, getMigrationFiles };
