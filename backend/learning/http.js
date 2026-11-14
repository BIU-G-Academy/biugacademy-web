"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { learningStatus } = require("./gates");
const { listAdapters, callAdapter } = require("../cubeshackles/adapters");
const { listCourses } = require("./catalog");
const service = require("./service");

const COOKIE = "biug_session";
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

const MESSAGES = {
  invalid_credentials: ["Credenciais inválidas.", "Invalid credentials."],
  provisioning_closed: [
    "A criação de contas está fechada. Este ambiente não cria contas para pessoas reais.",
    "Account creation is closed. This environment does not provision real people.",
  ],
  age_requirement: [
    "O piloto de aprendizagem é apenas para pessoas com 18 anos ou mais.",
    "The learning pilot is for people 18 or older only.",
  ],
  validation_failed: ["Os dados enviados não são válidos.", "The submitted data is not valid."],
  display_name_not_contact: [
    "O nome visível não pode ser um contacto.",
    "The display name cannot be a contact address.",
  ],
  password_too_close_to_login: [
    "A palavra-passe não pode conter o nome de utilizador.",
    "The password cannot contain the username.",
  ],
  login_taken: ["Esse nome de utilizador já existe.", "That username already exists."],
  not_found: ["Não encontrado.", "Not found."],
  account_not_found: ["Conta não encontrada.", "Account not found."],
  role_mismatch: [
    "Uma conta de formando só pode entrar como formando.",
    "A learner account can only join as a learner.",
  ],
  already_member: ["Esta conta já está na turma.", "This account is already in the cohort."],
  slug_taken: ["Esse identificador de turma já existe.", "That cohort identifier already exists."],
  course_not_found: ["Curso não encontrado.", "Course not found."],
  track_mismatch: [
    "O curso não pertence ao percurso desta turma.",
    "The course does not belong to this cohort track.",
  ],
  course_already_assigned: ["Esse curso já está atribuído.", "That course is already assigned."],
  not_a_learner: [
    "Só o formando da turma pode marcar o próprio progresso.",
    "Only the learner member can record their own progress.",
  ],
  checklist_incomplete: [
    "A lista de verificação ainda não está completa.",
    "The checklist is not complete yet.",
  ],
  missing_client_header: ["Pedido recusado.", "Request refused."],
  forbidden: ["Sem autorização para esta operação.", "Not authorized for this operation."],
  learning_store_unavailable: [
    "O armazenamento de aprendizagem não está disponível.",
    "The learning store is not available.",
  ],
};

function send(res, status, body) {
  res.set("Cache-Control", "no-store");
  res.status(status).json({ ...body, production_ready: false });
}

function fail(res, error) {
  if (error instanceof service.ServiceError) {
    const pair = MESSAGES[error.code] || MESSAGES.validation_failed;
    return send(res, error.status, {
      ok: false,
      error: error.code,
      fields: error.fields || undefined,
      message_pt: pair[0],
      message_en: pair[1],
    });
  }
  console.error("Learning request failed");
  return send(res, 500, {
    ok: false,
    error: "internal_error",
    message_pt: "Não foi possível concluir o pedido.",
    message_en: "The request could not be completed.",
  });
}

function readCookie(header, name) {
  if (!header) return "";
  for (const part of String(header).split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return "";
}

function writeSessionCookie(res, token, env, maxAgeSeconds) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (env.NODE_ENV === "production" || env.ACADEMY_COOKIE_SECURE === "true") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res, env) {
  writeSessionCookie(res, "", env, 0);
}

function createLearningRouter(options = {}) {
  const env = options.env || process.env;
  const now = options.now || (() => Date.now());
  const sessionTtlMs = options.sessionTtlMs || DEFAULT_TTL_MS;
  const router = express.Router();
  let pgStore;

  async function storeForRequest() {
    if (options.store) return options.store;
    if (!pgStore) {
      const { createPgStore } = require("./pg-store");
      const { getPool } = require("../db");
      pgStore = createPgStore(getPool());
    }
    return pgStore;
  }

  router.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    if (req.get("x-biug-client") !== "academy") {
      return send(res, 403, {
        ok: false,
        error: "missing_client_header",
        message_pt: MESSAGES.missing_client_header[0],
        message_en: MESSAGES.missing_client_header[1],
      });
    }
    return next();
  });

  router.get("/learning/status", (_req, res) => {
    send(res, 200, learningStatus(env));
  });

  router.use(async (req, res, next) => {
    try {
      req.academyStore = await storeForRequest();
      return next();
    } catch (_error) {
      return send(res, 503, {
        ok: false,
        error: "learning_store_unavailable",
        message_pt: MESSAGES.learning_store_unavailable[0],
        message_en: MESSAGES.learning_store_unavailable[1],
      });
    }
  });

  const loginLimit = options.loginRateLimit || { windowMs: 15 * 60 * 1000, max: 10 };
  const loginLimiter = rateLimit({
    windowMs: loginLimit.windowMs,
    max: loginLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      production_ready: false,
      error: "rate_limited",
      message_pt: "Demasiadas tentativas. Tente mais tarde.",
      message_en: "Too many attempts. Try again later.",
    },
  });

  router.post("/auth/login", loginLimiter, async (req, res) => {
    try {
      const result = await service.authenticate(req.academyStore, req.body, { now, sessionTtlMs });
      writeSessionCookie(res, result.token, env, Math.floor(sessionTtlMs / 1000));
      return send(res, 200, {
        ok: true,
        account: result.account,
        synthetic_demo: learningStatus(env).synthetic_demo,
        expires_at: result.expiresAt,
      });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post("/auth/logout", async (req, res) => {
    try {
      const token = readCookie(req.headers.cookie, COOKIE);
      if (token) {
        const { hashToken } = require("./passwords");
        await req.academyStore.revokeSession(hashToken(token), new Date(now()).toISOString());
      }
      clearSessionCookie(res, env);
      return send(res, 200, { ok: true, logged_out: true });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get("/auth/session", async (req, res) => {
    try {
      const account = await service.actorFromToken(
        req.academyStore,
        readCookie(req.headers.cookie, COOKIE),
        now()
      );
      if (!account) {
        return send(res, 401, {
          ok: false,
          error: "unauthenticated",
          message_pt: "Sessão inexistente.",
          message_en: "No session.",
        });
      }
      return send(res, 200, {
        ok: true,
        account: service.publicAccount(account),
        synthetic_demo: learningStatus(env).synthetic_demo,
      });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.use(async (req, res, next) => {
    try {
      const account = await service.actorFromToken(
        req.academyStore,
        readCookie(req.headers.cookie, COOKIE),
        now()
      );
      if (!account) {
        return send(res, 401, {
          ok: false,
          error: "unauthenticated",
          message_pt: "Sessão inexistente.",
          message_en: "No session.",
        });
      }
      req.actor = account;
      return next();
    } catch (error) {
      return fail(res, error);
    }
  });

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!roles.includes(req.actor.role)) {
        return send(res, 403, {
          ok: false,
          error: "forbidden",
          message_pt: MESSAGES.forbidden[0],
          message_en: MESSAGES.forbidden[1],
        });
      }
      return next();
    };
  }

  router.get("/catalog/courses", (_req, res) => {
    const courses = listCourses().map((course) => ({
      id: course.id,
      track: course.track,
      title_pt: course.title_pt,
      title_en: course.title_en,
      summary_pt: course.summary_pt,
      summary_en: course.summary_en,
      module_count: course.modules.length,
    }));
    send(res, 200, { ok: true, courses });
  });

  router.get("/tools", (_req, res) => {
    send(res, 200, { ok: true, adapters: listAdapters(), cubeshackles_tools: "unconfigured" });
  });

  router.post("/tools/:adapterId/call", async (req, res) => {
    let calls = 0;
    const result = await callAdapter(req.params.adapterId, {
      env,
      fetch: async () => {
        calls += 1;
        throw new Error("adapter_network_blocked");
      },
    });
    if (calls !== 0) {
      return send(res, 500, { ok: false, error: "adapter_network_blocked", called: true });
    }
    return send(res, result.status, result.body);
  });

  router.get("/cohorts", async (req, res) => {
    try {
      const cohorts = await service.visibleCohorts(req.academyStore, req.actor);
      return send(res, 200, { ok: true, cohorts });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get("/cohorts/:cohortId", async (req, res) => {
    try {
      const body = await service.readCohort(req.academyStore, req.actor, req.params.cohortId);
      return send(res, 200, { ok: true, ...body });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get("/cohorts/:cohortId/insights", async (req, res) => {
    try {
      const body = await service.insightsFor(req.academyStore, req.actor, req.params.cohortId);
      return send(res, 200, { ok: true, ...body });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post("/cohorts/:cohortId/modules/:moduleId/complete", async (req, res) => {
    try {
      const body = await service.completeModule(
        req.academyStore,
        req.actor,
        req.params.cohortId,
        req.params.moduleId,
        req.body
      );
      return send(res, 200, { ok: true, ...body });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get("/admin/overview", requireRole("admin"), async (req, res) => {
    try {
      const body = await service.overview(req.academyStore);
      return send(res, 200, { ok: true, ...body, status: learningStatus(env) });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get("/admin/accounts", requireRole("admin"), async (req, res) => {
    try {
      const accounts = await req.academyStore.listAccounts();
      return send(res, 200, { ok: true, accounts: accounts.map(service.publicAccount) });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post("/admin/accounts", requireRole("admin"), async (req, res) => {
    try {
      const account = await service.createAccount(req.academyStore, req.body, env);
      return send(res, 201, {
        ok: true,
        account,
        synthetic_demo: true,
        not_production_ready: true,
      });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post("/admin/accounts/:accountId/disable", requireRole("admin"), async (req, res) => {
    try {
      const account = await service.disableAccount(
        req.academyStore,
        req.params.accountId,
        new Date(now()).toISOString()
      );
      return send(res, 200, { ok: true, account });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post("/admin/cohorts", requireRole("admin"), async (req, res) => {
    try {
      const cohort = await service.createCohort(req.academyStore, req.actor, req.body);
      return send(res, 201, { ok: true, cohort });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post("/admin/cohorts/:cohortId/members", requireRole("admin"), async (req, res) => {
    try {
      const membership = await service.addMember(req.academyStore, req.params.cohortId, req.body);
      return send(res, 201, { ok: true, membership });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post("/admin/cohorts/:cohortId/courses", requireRole("admin"), async (req, res) => {
    try {
      const assignment = await service.assignCourse(
        req.academyStore,
        req.params.cohortId,
        req.body
      );
      return send(res, 201, { ok: true, assignment });
    } catch (error) {
      return fail(res, error);
    }
  });

  return router;
}

module.exports = { createLearningRouter, COOKIE, MESSAGES };
