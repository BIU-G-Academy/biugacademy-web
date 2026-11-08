"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("fs");
const path = require("path");

const { app } = require("../server");
const { CLOSED_PT, CLOSED_EN } = require("../learning/gates");

function request(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.address().port,
        path: requestPath,
        method,
        headers,
      },
      (res) => {
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
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let server;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
});

after(async () => {
  if (server) server.close();
});

describe("GET /api/health", () => {
  it("returns ok: true", async () => {
    const res = await request("GET", "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.service, "biug-academy-intake-api");
    assert.equal(res.body.status, "healthy");
  });
});

describe("personal-data intake is fail-closed", () => {
  it("does not persist a waitlist submission", async () => {
    const res = await request("POST", "/api/waitlist", {
      full_name: "Not Stored",
      email: "not-stored@example.com",
      phone_number: "+244923456789",
      honeypot: "",
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.intake, "closed");
    assert.equal(res.body.persisted, false);
    assert.equal(res.body.production_ready, false);
    assert.equal(res.body.message_pt, CLOSED_PT);
    assert.equal(res.body.message_en, CLOSED_EN);
    assert.equal(res.body.message_pt, "As candidaturas ainda não estão abertas.");
    assert.equal(res.body.message_en, "Applications are not open yet.");
    assert.equal(JSON.stringify(res.body).includes("not-stored@example.com"), false);
  });

  it("does not accept a honeypot payload as success", async () => {
    const res = await request("POST", "/api/waitlist", { honeypot: "bot-filled" });
    assert.equal(res.status, 403);
    assert.equal(res.body.persisted, false);
    assert.equal(res.body.message_en, "Applications are not open yet.");
  });

  it("does not persist a support request", async () => {
    const res = await request("POST", "/api/support", {
      name: "Not Stored",
      email: "support-not-stored@example.com",
      message: "Please do not store this.",
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.intake, "closed");
    assert.equal(res.body.persisted, false);
    assert.equal(res.body.message_pt, "Este canal não está a receber dados pessoais.");
    assert.equal(res.body.message_en, "This channel is not accepting personal data.");
  });
});

describe("learning status on the main app", () => {
  it("reports the service as not production-ready", async () => {
    const res = await request("GET", "/api/learning/status");
    assert.equal(res.status, 200);
    assert.equal(res.body.production_ready, false);
    assert.equal(res.body.personal_data_intake, "closed");
    assert.equal(res.body.cubeshackles_tools, "unconfigured");
    assert.equal(res.body.pilot_minimum_age, 18);
    assert.equal(res.body.message_pt, "As candidaturas ainda não estão abertas.");
    assert.equal(res.body.message_en, "Applications are not open yet.");
  });
});

describe("published server does not seed demo users", () => {
  it("does not reference the synthetic seed from server.js", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
    assert.equal(source.includes("synthetic-seed"), false);
    assert.equal(source.includes("sint-administrador"), false);
    assert.equal(source.includes("sint-formando"), false);
  });
});
