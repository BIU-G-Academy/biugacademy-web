"use strict";

const path = require("path");
const express = require("express");
const { createLearningRouter } = require("../learning/http");
const { createMemoryStore } = require("../learning/memory-store");
const { seedSynthetic } = require("../learning/synthetic-seed");

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing synthetic demo when NODE_ENV=production.");
    process.exit(1);
  }
  process.env.ACADEMY_SYNTHETIC_DEMO = "1";
  process.env.ACADEMY_ACCOUNT_PROVISIONING = "synthetic-local";
  const store = createMemoryStore();
  const seeded = await seedSynthetic(store, process.env);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", createLearningRouter({ store, env: process.env }));
  app.use(
    "/learn",
    express.static(path.join(__dirname, "..", "..", "portal", "learn"), {
      index: "index.html",
      setHeaders(res) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
      },
    })
  );
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Synthetic learning demo on http://127.0.0.1:${port}/learn/`);
    console.log(`Synthetic logins: ${seeded.logins.join(", ")}`);
    console.log("Password is ACADEMY_SYNTHETIC_PASSWORD and is not printed.");
    console.log("In-memory synthetic data. Not production. Lost when this process stops.");
    console.log(`Seed cohort: ${seeded.cohort_id}`);
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exit(1);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { main };
