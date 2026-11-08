"use strict";

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("crypto");
const express = require("express");
const { createLearningRouter } = require("../learning/http");
const { createMemoryStore } = require("../learning/memory-store");
const { hashPassword } = require("../learning/passwords");
const { getCourse } = require("../learning/catalog");

const PASSWORD = "test-only-password";
const DEV_MODULE_1 = [
  "app_identity",
  "installation_scoped",
  "short_lived_tokens",
  "explicit_repo_selection",
  "minimum_permissions",
  "no_secrets_in_repo",
];
const DEV_MODULE_2 = ["tools_unconfigured", "no_live_call", "not_production"];
const servers = [];

function cookieFrom(setCookie) {
  return String((setCookie && setCookie[0]) || "").split(";")[0];
}

function request(server, method, requestPath, { body, cookie, clientHeader = true } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = { Accept: "application/json" };
    if (payload) headers["Content-Type"] = "application/json";
    if (clientHeader && method !== "GET") headers["X-BIUG-Client"] = "academy";
    if (cookie) headers.Cookie = cookie;
    const req = http.request(
      { hostname: "127.0.0.1", port: server.address().port, path: requestPath, method, headers },
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
          resolve({
            status: res.statusCode,
            body: parsed,
            setCookie: res.headers["set-cookie"] || [],
          });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function start(env, extra = {}) {
  const store = extra.store || createMemoryStore();
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use(
    "/api",
    createLearningRouter({
      store,
      env,
      loginRateLimit: { windowMs: 60_000, max: 1000 },
      ...extra.router,
    })
  );
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  servers.push(server);
  return { server, store };
}

async function seedAccount(store, spec) {
  const account = {
    id: crypto.randomUUID(),
    login_name: spec.login_name,
    password_hash: await hashPassword(spec.password || PASSWORD),
    display_name: spec.display_name,
    role: spec.role,
    locale: "pt",
    age_attested_18: true,
    status: spec.status || "active",
    created_at: new Date().toISOString(),
  };
  await store.createAccount(account);
  return account;
}

async function login(server, loginName) {
  const res = await request(server, "POST", "/api/auth/login", {
    body: { login_name: loginName, password: PASSWORD },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.production_ready, false);
  assert.equal(JSON.stringify(res.body).includes("password_hash"), false);
  assert.equal(JSON.stringify(res.body).includes("scrypt$"), false);
  const cookie = cookieFrom(res.setCookie);
  assert.match(res.setCookie[0], /HttpOnly/i);
  assert.match(res.setCookie[0], /SameSite=Lax/i);
  return cookie;
}

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
});

describe("auth, RBAC, and cohort isolation", { concurrency: 1 }, () => {
  it("requires the client header, rotates sessions, and logs out server-side", async () => {
    const { server, store } = await start({ NODE_ENV: "test" });
    await seedAccount(store, { login_name: "ada-admin", display_name: "Ada Admin", role: "admin" });
    const missing = await request(server, "POST", "/api/auth/login", {
      body: { login_name: "ada-admin", password: PASSWORD },
      clientHeader: false,
    });
    assert.equal(missing.status, 403);
    assert.equal(missing.body.error, "missing_client_header");

    const wrong = await request(server, "POST", "/api/auth/login", {
      body: { login_name: "ada-admin", password: "not-the-password" },
    });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, "invalid_credentials");
    assert.equal(wrong.body.message_pt, "Credenciais inválidas.");

    const first = await login(server, "ada-admin");
    const second = await login(server, "ada-admin");
    const oldSession = await request(server, "GET", "/api/auth/session", { cookie: first });
    assert.equal(oldSession.status, 401);
    const current = await request(server, "GET", "/api/auth/session", { cookie: second });
    assert.equal(current.status, 200);
    assert.equal(current.body.account.role, "admin");
    assert.equal(current.body.account.password_hash, undefined);

    const loggedOut = await request(server, "POST", "/api/auth/logout", { cookie: second });
    assert.equal(loggedOut.status, 200);
    const afterLogout = await request(server, "GET", "/api/auth/session", { cookie: second });
    assert.equal(afterLogout.status, 401);
  });

  it("expires sessions using the server clock", async () => {
    let current = Date.parse("2026-11-07T12:00:00Z");
    const { server, store } = await start(
      { NODE_ENV: "test" },
      { router: { now: () => current, sessionTtlMs: 1000 } }
    );
    await seedAccount(store, {
      login_name: "clock-user",
      display_name: "Clock User",
      role: "learner",
    });
    const cookie = await login(server, "clock-user");
    current += 1001;
    const expired = await request(server, "GET", "/api/auth/session", { cookie });
    assert.equal(expired.status, 401);
  });

  it("blocks provisioning unless the synthetic local gate is open, including in production", async () => {
    const closed = await start({ NODE_ENV: "test" });
    await seedAccount(closed.store, {
      login_name: "closed-admin",
      display_name: "Closed Admin",
      role: "admin",
    });
    const closedCookie = await login(closed.server, "closed-admin");
    const refused = await request(closed.server, "POST", "/api/admin/accounts", {
      cookie: closedCookie,
      body: {
        login_name: "new-learner",
        display_name: "New Learner",
        password: PASSWORD,
        role: "learner",
        age_attested_18: true,
        email: "hidden@example.com",
      },
    });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error, "provisioning_closed");
    assert.equal(JSON.stringify(refused.body).includes("hidden@example.com"), false);
    assert.equal(JSON.stringify(refused.body).includes(PASSWORD), false);

    const production = await start({
      NODE_ENV: "production",
      ACADEMY_SYNTHETIC_DEMO: "1",
      ACADEMY_ACCOUNT_PROVISIONING: "synthetic-local",
      ACADEMY_PRIVACY_ARCHITECTURE_APPROVED: "true",
      ACADEMY_COUNSEL_REVIEW_REFERENCE: "not-a-real-opinion",
    });
    await seedAccount(production.store, {
      login_name: "prod-admin",
      display_name: "Prod Admin",
      role: "admin",
    });
    const prodLogin = await request(production.server, "POST", "/api/auth/login", {
      body: { login_name: "prod-admin", password: PASSWORD },
    });
    assert.match(prodLogin.setCookie[0], /Secure/i);
    const prodCookie = cookieFrom(prodLogin.setCookie);
    const stillClosed = await request(production.server, "POST", "/api/admin/accounts", {
      cookie: prodCookie,
      body: {
        login_name: "real-person",
        display_name: "Real Person",
        password: PASSWORD,
        role: "learner",
        age_attested_18: true,
      },
    });
    assert.equal(stillClosed.status, 403);
    assert.equal(stillClosed.body.error, "provisioning_closed");
  });

  it("rejects under-18 attestation and contact fields, then isolates cohorts", async () => {
    const env = {
      NODE_ENV: "test",
      ACADEMY_SYNTHETIC_DEMO: "1",
      ACADEMY_ACCOUNT_PROVISIONING: "synthetic-local",
    };
    const { server, store } = await start(env);
    await seedAccount(store, {
      login_name: "root-admin",
      display_name: "Root Admin",
      role: "admin",
    });
    const admin = await login(server, "root-admin");

    const underAge = await request(server, "POST", "/api/admin/accounts", {
      cookie: admin,
      body: {
        login_name: "minor-user",
        display_name: "Minor User",
        password: PASSWORD,
        role: "learner",
        age_attested_18: false,
      },
    });
    assert.equal(underAge.status, 403);
    assert.equal(underAge.body.error, "age_requirement");

    const contactName = await request(server, "POST", "/api/admin/accounts", {
      cookie: admin,
      body: {
        login_name: "mail-name",
        display_name: "ada@example.com",
        password: PASSWORD,
        role: "learner",
        age_attested_18: true,
      },
    });
    assert.equal(contactName.status, 400);
    assert.equal(contactName.body.error, "display_name_not_contact");

    async function makeAccount(loginName, displayName, role) {
      const res = await request(server, "POST", "/api/admin/accounts", {
        cookie: admin,
        body: {
          login_name: loginName,
          display_name: displayName,
          password: PASSWORD,
          role,
          age_attested_18: true,
        },
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.not_production_ready, true);
      assert.equal(res.body.account.password_hash, undefined);
      return res.body.account;
    }

    const learnerA = await makeAccount("learner-alfa", "Aprendiz Alfa", "learner");
    const learnerB = await makeAccount("learner-bravo", "Aprendiz Bravo", "learner");
    const instructor = await makeAccount("instrutor-um", "Instrutor Um", "instructor");

    const listed = await request(server, "GET", "/api/admin/accounts", { cookie: admin });
    assert.equal(listed.status, 200);
    assert.equal(JSON.stringify(listed.body).includes("password_hash"), false);
    assert.equal(JSON.stringify(listed.body).includes("email"), false);
    assert.equal(JSON.stringify(listed.body).includes("phone"), false);

    async function makeCohort(slug, name, track) {
      const res = await request(server, "POST", "/api/admin/cohorts", {
        cookie: admin,
        body: { slug, name, track, summary: "Turma sintética de teste." },
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      return res.body.cohort;
    }

    const cohortA = await makeCohort("turma-alfa", "Turma Alfa", "developer");
    const cohortB = await makeCohort("turma-bravo", "Turma Bravo", "nondeveloper");
    const devCourse = "dev-cubeshackles-orientation";
    const accessCourse = "access-cubeshackles-orientation";
    assert.ok(getCourse(devCourse));
    assert.ok(getCourse(accessCourse));

    const mismatch = await request(server, "POST", `/api/admin/cohorts/${cohortA.id}/courses`, {
      cookie: admin,
      body: { course_id: accessCourse },
    });
    assert.equal(mismatch.status, 400);
    assert.equal(mismatch.body.error, "track_mismatch");

    assert.equal(
      (
        await request(server, "POST", `/api/admin/cohorts/${cohortA.id}/courses`, {
          cookie: admin,
          body: { course_id: devCourse },
        })
      ).status,
      201
    );
    assert.equal(
      (
        await request(server, "POST", `/api/admin/cohorts/${cohortB.id}/courses`, {
          cookie: admin,
          body: { course_id: accessCourse },
        })
      ).status,
      201
    );

    async function addMember(cohortId, accountId, membershipRole) {
      const res = await request(server, "POST", `/api/admin/cohorts/${cohortId}/members`, {
        cookie: admin,
        body: { account_id: accountId, membership_role: membershipRole },
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
    }
    await addMember(cohortA.id, learnerA.id, "learner");
    await addMember(cohortA.id, instructor.id, "instructor");
    await addMember(cohortB.id, learnerB.id, "learner");
    const learnerAsInstructor = await request(
      server,
      "POST",
      `/api/admin/cohorts/${cohortA.id}/members`,
      {
        cookie: admin,
        body: { account_id: learnerB.id, membership_role: "instructor" },
      }
    );
    assert.equal(learnerAsInstructor.status, 403);
    assert.equal(learnerAsInstructor.body.error, "role_mismatch");

    const learnerCookie = await login(server, "learner-alfa");
    const bravoCookie = await login(server, "learner-bravo");
    const instructorCookie = await login(server, "instrutor-um");

    const learnerCohorts = await request(server, "GET", "/api/cohorts", { cookie: learnerCookie });
    assert.deepEqual(
      learnerCohorts.body.cohorts.map((cohort) => cohort.id),
      [cohortA.id]
    );
    const hidden = await request(server, "GET", `/api/cohorts/${cohortB.id}`, {
      cookie: learnerCookie,
    });
    assert.equal(hidden.status, 404);
    const hiddenInsights = await request(server, "GET", `/api/cohorts/${cohortB.id}/insights`, {
      cookie: learnerCookie,
    });
    assert.equal(hiddenInsights.status, 404);
    const hiddenComplete = await request(
      server,
      "POST",
      `/api/cohorts/${cohortB.id}/modules/access-what-is-public/complete`,
      {
        cookie: learnerCookie,
        body: { checklist: ["pre_production", "angola_origin", "not_regulatory_approval"] },
      }
    );
    assert.equal(hiddenComplete.status, 404);

    const forbiddenAdmin = await request(server, "GET", "/api/admin/overview", {
      cookie: learnerCookie,
    });
    assert.equal(forbiddenAdmin.status, 403);
    const instructorAdmin = await request(server, "POST", "/api/admin/cohorts", {
      cookie: instructorCookie,
      body: { slug: "nao-autorizada", name: "Nao Autorizada", track: "developer" },
    });
    assert.equal(instructorAdmin.status, 403);

    const unauthenticated = await request(server, "GET", "/api/cohorts");
    assert.equal(unauthenticated.status, 401);

    const incomplete = await request(
      server,
      "POST",
      `/api/cohorts/${cohortA.id}/modules/dev-github-app-notes/complete`,
      {
        cookie: learnerCookie,
        body: { checklist: ["app_identity"] },
      }
    );
    assert.equal(incomplete.status, 400);
    assert.equal(incomplete.body.error, "checklist_incomplete");
    const before = await request(server, "GET", `/api/cohorts/${cohortA.id}/insights`, {
      cookie: learnerCookie,
    });
    assert.equal(before.body.scope, "self");
    assert.equal(before.body.my_completed, 0);
    assert.equal(
      before.body.badges.every((badge) => badge.earned === false),
      true
    );
    assert.equal(JSON.stringify(before.body).includes("Aprendiz Bravo"), false);
    assert.equal(before.body.stalled_learners, undefined);

    const instructorCannotComplete = await request(
      server,
      "POST",
      `/api/cohorts/${cohortA.id}/modules/dev-github-app-notes/complete`,
      { cookie: instructorCookie, body: { checklist: DEV_MODULE_1 } }
    );
    assert.equal(instructorCannotComplete.status, 403);
    assert.equal(instructorCannotComplete.body.error, "not_a_learner");

    const firstDone = await request(
      server,
      "POST",
      `/api/cohorts/${cohortA.id}/modules/dev-github-app-notes/complete`,
      {
        cookie: learnerCookie,
        body: { checklist: DEV_MODULE_1 },
      }
    );
    assert.equal(firstDone.status, 200, JSON.stringify(firstDone.body));
    assert.equal(firstDone.body.my_completed, 1);
    assert.equal(firstDone.body.badges.find((badge) => badge.id === "primeiro_passo").earned, true);
    assert.equal(
      firstDone.body.badges.find((badge) => badge.id === "trilha_concluida").earned,
      false
    );

    const secondDone = await request(
      server,
      "POST",
      `/api/cohorts/${cohortA.id}/modules/dev-tool-boundary/complete`,
      {
        cookie: learnerCookie,
        body: { checklist: DEV_MODULE_2 },
      }
    );
    assert.equal(secondDone.status, 200);
    assert.equal(
      secondDone.body.badges.find((badge) => badge.id === "trilha_concluida").earned,
      true
    );
    const repeat = await request(
      server,
      "POST",
      `/api/cohorts/${cohortA.id}/modules/dev-tool-boundary/complete`,
      {
        cookie: learnerCookie,
        body: { checklist: DEV_MODULE_2 },
      }
    );
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.my_completed, 2);

    const added = await request(server, "POST", `/api/admin/cohorts/${cohortA.id}/courses`, {
      cookie: admin,
      body: { course_id: "dev-review-checklist" },
    });
    assert.equal(added.status, 201);
    const afterAssign = await request(server, "GET", `/api/cohorts/${cohortA.id}/insights`, {
      cookie: learnerCookie,
    });
    assert.equal(
      afterAssign.body.badges.find((badge) => badge.id === "primeiro_passo").earned,
      true
    );
    assert.equal(
      afterAssign.body.badges.find((badge) => badge.id === "trilha_concluida").earned,
      false
    );
    assert.equal(afterAssign.body.my_remaining.includes("dev-review-one"), true);

    const staff = await request(server, "GET", `/api/cohorts/${cohortA.id}/insights`, {
      cookie: instructorCookie,
    });
    assert.equal(staff.status, 200);
    assert.equal(staff.body.scope, "cohort_staff");
    assert.equal(staff.body.learner_count, 1);
    assert.equal(
      staff.body.modules.find((mod) => mod.id === "dev-github-app-notes").completed_count,
      1
    );
    assert.deepEqual(staff.body.stalled_learners, []);
    assert.equal(JSON.stringify(staff.body).includes("Aprendiz Bravo"), false);
    assert.equal(JSON.stringify(staff.body).includes(cohortB.id), false);

    const bravoOwn = await request(server, "GET", `/api/cohorts/${cohortB.id}/insights`, {
      cookie: bravoCookie,
    });
    assert.equal(bravoOwn.body.my_completed, 0);
    assert.equal(bravoOwn.body.cohort.id, cohortB.id);
    const bravoSeesAlfa = await request(server, "GET", `/api/cohorts/${cohortA.id}`, {
      cookie: bravoCookie,
    });
    assert.equal(bravoSeesAlfa.status, 404);

    const toolCall = await request(server, "POST", "/api/tools/tool-api/call", {
      cookie: learnerCookie,
      body: {},
    });
    assert.equal(toolCall.status, 503);
    assert.equal(toolCall.body.called, false);
    assert.equal(toolCall.body.adapter_status, "unconfigured");
    const tools = await request(server, "GET", "/api/tools", { cookie: learnerCookie });
    assert.equal(
      tools.body.adapters.every((adapter) => adapter.callable === false),
      true
    );

    const overview = await request(server, "GET", "/api/admin/overview", { cookie: admin });
    assert.equal(overview.status, 200);
    assert.equal(overview.body.production_ready, false);
    assert.equal(overview.body.status.personal_data_intake, "closed");
    assert.ok(overview.body.cohort_count >= 2);
  });

  it("disables an account and revokes its session", async () => {
    const { server, store } = await start({ NODE_ENV: "test" });
    const adminAccount = await seedAccount(store, {
      login_name: "disable-admin",
      display_name: "Disable Admin",
      role: "admin",
    });
    const learner = await seedAccount(store, {
      login_name: "disable-learner",
      display_name: "Disable Learner",
      role: "learner",
    });
    const admin = await login(server, "disable-admin");
    const learnerCookie = await login(server, "disable-learner");
    const disabled = await request(server, "POST", `/api/admin/accounts/${learner.id}/disable`, {
      cookie: admin,
    });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.account.status, "disabled");
    const session = await request(server, "GET", "/api/auth/session", { cookie: learnerCookie });
    assert.equal(session.status, 401);
    const again = await request(server, "POST", "/api/auth/login", {
      body: { login_name: "disable-learner", password: PASSWORD },
    });
    assert.equal(again.status, 401);
    assert.notEqual(adminAccount.id, learner.id);
  });
});
