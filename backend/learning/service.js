"use strict";

const { randomUUID } = require("crypto");
const { z } = require("zod");
const { hashPassword, verifyPassword, hashToken, newSessionToken } = require("./passwords");
const { provisioningMode } = require("./gates");
const { getCourse, getModule, listBadges, modulesForCourseIds } = require("./catalog");

class ServiceError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const loginSchema = z
  .object({
    login_name: z.string().trim().min(1).max(40),
    password: z.string().min(1).max(200),
  })
  .strict();

const accountSchema = z
  .object({
    login_name: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{2,39}$/),
    display_name: z.string().trim().min(2).max(40),
    password: z.string().min(12).max(200),
    role: z.enum(["learner", "instructor", "admin"]),
    locale: z.enum(["pt", "en"]).optional().default("pt"),
    age_attested_18: z.literal(true),
  })
  .strict();

const cohortSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(48),
    track: z.enum(["developer", "nondeveloper"]),
    summary: z.string().trim().max(280).optional().default(""),
  })
  .strict();

const memberSchema = z
  .object({
    account_id: z.string().uuid(),
    membership_role: z.enum(["learner", "instructor"]),
  })
  .strict();

const courseAssignSchema = z
  .object({
    course_id: z.string().trim().min(1).max(80),
  })
  .strict();

const completeSchema = z
  .object({
    checklist: z.array(z.string().trim().min(1).max(80)).max(30),
  })
  .strict();

function publicAccount(account) {
  return {
    id: account.id,
    login_name: account.login_name,
    display_name: account.display_name,
    role: account.role,
    locale: account.locale,
    status: account.status,
    age_attested_18: account.age_attested_18 === true,
  };
}

function publicCohort(cohort) {
  return {
    id: cohort.id,
    slug: cohort.slug,
    name: cohort.name,
    track: cohort.track,
    summary: cohort.summary || "",
  };
}

function validationError(parsed) {
  const error = new ServiceError(400, "validation_failed");
  error.fields = parsed.error.issues.map((issue) => issue.path.join(".") || "body");
  return error;
}

let dummyHashPromise;

async function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("synthetic-timing-pad");
  return dummyHashPromise;
}

async function authenticate(store, body, options) {
  const parsed = loginSchema.safeParse(body || {});
  if (!parsed.success) throw validationError(parsed);
  const account = await store.findAccountByLogin(parsed.data.login_name.toLowerCase());
  const passwordOk = await verifyPassword(
    parsed.data.password,
    account ? account.password_hash : await dummyHash()
  );
  if (!account || !passwordOk || account.status !== "active") {
    throw new ServiceError(401, "invalid_credentials");
  }
  const now = options.now();
  const token = newSessionToken();
  const expiresAt = new Date(now + options.sessionTtlMs).toISOString();
  await store.withTransaction(async (tx) => {
    await tx.revokeSessionsForAccount(account.id, new Date(now).toISOString());
    await tx.createSession({
      token_hash: hashToken(token),
      account_id: account.id,
      expires_at: expiresAt,
      revoked_at: null,
    });
  });
  return { token, expiresAt, account: publicAccount(account) };
}

async function actorFromToken(store, token, now) {
  if (!token) return null;
  const session = await store.findSessionByTokenHash(hashToken(token));
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= now) return null;
  const account = await store.findAccountById(session.account_id);
  if (!account || account.status !== "active") return null;
  return account;
}

async function createAccount(store, body, env) {
  if (provisioningMode(env) !== "synthetic-local")
    throw new ServiceError(403, "provisioning_closed");
  const parsed = accountSchema.safeParse(body || {});
  if (!parsed.success) {
    if (body && body.age_attested_18 === false) throw new ServiceError(403, "age_requirement");
    throw validationError(parsed);
  }
  if (parsed.data.display_name.includes("@"))
    throw new ServiceError(400, "display_name_not_contact");
  if (parsed.data.password.toLowerCase().includes(parsed.data.login_name)) {
    throw new ServiceError(400, "password_too_close_to_login");
  }
  const loginName = parsed.data.login_name.toLowerCase();
  if (await store.findAccountByLogin(loginName)) throw new ServiceError(409, "login_taken");
  const account = await store.createAccount({
    id: randomUUID(),
    login_name: loginName,
    password_hash: await hashPassword(parsed.data.password),
    display_name: parsed.data.display_name,
    role: parsed.data.role,
    locale: parsed.data.locale,
    age_attested_18: true,
    status: "active",
    created_at: new Date().toISOString(),
  });
  return publicAccount(account);
}

async function disableAccount(store, accountId, nowIso) {
  if (!z.string().uuid().safeParse(accountId).success) throw new ServiceError(404, "not_found");
  const account = await store.findAccountById(accountId);
  if (!account) throw new ServiceError(404, "not_found");
  await store.withTransaction(async (tx) => {
    await tx.setAccountStatus(accountId, "disabled");
    await tx.revokeSessionsForAccount(accountId, nowIso);
  });
  const updated = await store.findAccountById(accountId);
  return publicAccount(updated);
}

async function createCohort(store, actor, body) {
  const parsed = cohortSchema.safeParse(body || {});
  if (!parsed.success) throw validationError(parsed);
  if (await store.findCohortBySlug(parsed.data.slug)) throw new ServiceError(409, "slug_taken");
  const cohort = await store.createCohort({
    id: randomUUID(),
    slug: parsed.data.slug,
    name: parsed.data.name,
    track: parsed.data.track,
    summary: parsed.data.summary,
    created_by: actor.id,
    created_at: new Date().toISOString(),
  });
  return publicCohort(cohort);
}

async function addMember(store, cohortId, body) {
  const cohort = await requireCohort(store, cohortId);
  const parsed = memberSchema.safeParse(body || {});
  if (!parsed.success) throw validationError(parsed);
  const account = await store.findAccountById(parsed.data.account_id);
  if (!account || account.status !== "active") throw new ServiceError(404, "account_not_found");
  if (account.role === "learner" && parsed.data.membership_role !== "learner") {
    throw new ServiceError(403, "role_mismatch");
  }
  if (await store.findMembership(cohort.id, account.id))
    throw new ServiceError(409, "already_member");
  await store.addMembership({
    cohort_id: cohort.id,
    account_id: account.id,
    membership_role: parsed.data.membership_role,
    created_at: new Date().toISOString(),
  });
  return {
    cohort_id: cohort.id,
    account_id: account.id,
    membership_role: parsed.data.membership_role,
  };
}

async function assignCourse(store, cohortId, body) {
  const cohort = await requireCohort(store, cohortId);
  const parsed = courseAssignSchema.safeParse(body || {});
  if (!parsed.success) throw validationError(parsed);
  const course = getCourse(parsed.data.course_id);
  if (!course) throw new ServiceError(404, "course_not_found");
  if (course.track !== cohort.track) throw new ServiceError(400, "track_mismatch");
  const existing = await store.listCourseIdsForCohort(cohort.id);
  if (existing.includes(course.id)) throw new ServiceError(409, "course_already_assigned");
  await store.withTransaction(async (tx) => {
    await tx.assignCourse({ cohort_id: cohort.id, course_id: course.id });
    const members = await tx.listMembershipsForCohort(cohort.id);
    for (const member of members.filter((item) => item.membership_role === "learner")) {
      await syncBadges(tx, member.account_id, cohort.id, null);
    }
  });
  return { cohort_id: cohort.id, course_id: course.id };
}

async function visibleCohorts(store, actor) {
  const cohorts = await store.listCohorts();
  if (actor.role === "admin") return cohorts.map(publicCohort);
  const memberships = await store.listMembershipsForAccount(actor.id);
  const allowed = new Set(memberships.map((item) => item.cohort_id));
  return cohorts.filter((cohort) => allowed.has(cohort.id)).map(publicCohort);
}

async function readCohort(store, actor, cohortId) {
  const { cohort, membership } = await assertCanRead(store, actor, cohortId);
  const courseIds = await store.listCourseIdsForCohort(cohort.id);
  const progress = await store.listProgressForAccountCohort(actor.id, cohort.id);
  const completed = new Set(
    progress.filter((row) => row.status === "completed").map((row) => row.module_id)
  );
  const courses = courseIds
    .map(getCourse)
    .filter(Boolean)
    .map((course) => ({
      id: course.id,
      track: course.track,
      title_pt: course.title_pt,
      title_en: course.title_en,
      summary_pt: course.summary_pt,
      summary_en: course.summary_en,
      modules: course.modules.map((mod) => ({
        id: mod.id,
        title_pt: mod.title_pt,
        title_en: mod.title_en,
        summary_pt: mod.summary_pt,
        summary_en: mod.summary_en,
        completed: completed.has(mod.id),
        exercise: mod.exercise,
      })),
    }));
  return {
    cohort: publicCohort(cohort),
    membership_role: membership
      ? membership.membership_role
      : actor.role === "admin"
        ? "admin"
        : null,
    courses,
  };
}

async function completeModule(store, actor, cohortId, moduleId, body) {
  const { cohort, membership } = await assertCanRead(store, actor, cohortId);
  if (!membership || membership.membership_role !== "learner")
    throw new ServiceError(403, "not_a_learner");
  const parsed = completeSchema.safeParse(body || {});
  if (!parsed.success) throw validationError(parsed);
  const located = getModule(moduleId);
  if (!located) throw new ServiceError(404, "not_found");
  const courseIds = await store.listCourseIdsForCohort(cohort.id);
  if (!courseIds.includes(located.course.id)) throw new ServiceError(404, "not_found");
  const required = located.module.exercise.items.map((item) => item.id);
  const given = new Set(parsed.data.checklist);
  const matches = required.length === given.size && required.every((id) => given.has(id));
  if (!matches) throw new ServiceError(400, "checklist_incomplete");
  const completedAt = new Date().toISOString();
  await store.withTransaction(async (tx) => {
    await tx.completeProgress({
      account_id: actor.id,
      cohort_id: cohort.id,
      module_id: located.module.id,
      status: "completed",
      completed_at: completedAt,
    });
    await syncBadges(tx, actor.id, cohort.id, located.module.id);
  });
  return insightsFor(store, actor, cohort.id);
}

async function insightsFor(store, actor, cohortId) {
  const { cohort, membership } = await assertCanRead(store, actor, cohortId);
  const staff =
    actor.role === "admin" || (membership && membership.membership_role === "instructor");
  const courseIds = await store.listCourseIdsForCohort(cohort.id);
  const modules = modulesForCourseIds(courseIds);
  const members = await store.listMembershipsForCohort(cohort.id);
  const learnerMembers = members.filter((item) => item.membership_role === "learner");
  const allProgress = await store.listProgressForCohort(cohort.id);
  const completed = allProgress.filter((row) => row.status === "completed");
  const possible = staff ? learnerMembers.length * modules.length : 0;
  const base = {
    cohort: publicCohort(cohort),
    module_count: modules.length,
    learner_count: staff ? learnerMembers.length : null,
    completed_count: staff ? completed.length : null,
    possible_completions: staff ? possible : null,
    completion_rate: staff && possible > 0 ? completed.length / possible : null,
    production_ready: false,
  };
  if (!staff) {
    const mine = completed.filter((row) => row.account_id === actor.id);
    const mineIds = new Set(mine.map((row) => row.module_id));
    const earned = await earnedBadges(store, actor.id, cohort.id);
    const next = modules.find((mod) => !mineIds.has(mod.id)) || null;
    return {
      ...base,
      scope: "self",
      my_completed: mine.length,
      my_remaining: modules.filter((mod) => !mineIds.has(mod.id)).map((mod) => mod.id),
      next_module: next ? { id: next.id, title_pt: next.title_pt, title_en: next.title_en } : null,
      badges: earned,
    };
  }
  const byModule = modules.map((mod) => ({
    id: mod.id,
    title_pt: mod.title_pt,
    title_en: mod.title_en,
    completed_count: completed.filter((row) => row.module_id === mod.id).length,
  }));
  const stalled = [];
  for (const member of learnerMembers) {
    const done = completed.some((row) => row.account_id === member.account_id);
    if (done) continue;
    const account = await store.findAccountById(member.account_id);
    if (account) stalled.push({ display_name: account.display_name });
  }
  return {
    ...base,
    scope: "cohort_staff",
    modules: byModule,
    stalled_learners: stalled,
  };
}

async function earnedBadges(store, accountId, cohortId) {
  const courseIds = await store.listCourseIdsForCohort(cohortId);
  const modules = modulesForCourseIds(courseIds);
  const progress = await store.listProgressForAccountCohort(accountId, cohortId);
  const completed = progress.filter((row) => row.status === "completed").length;
  const eligible = new Set();
  if (completed >= 1) eligible.add("primeiro_passo");
  if (modules.length > 0 && completed === modules.length) eligible.add("trilha_concluida");
  const stored = await store.listBadges(accountId, cohortId);
  const earnedIds = new Set(stored.map((row) => row.badge_id).filter((id) => eligible.has(id)));
  return listBadges().map((badge) => ({
    id: badge.id,
    title_pt: badge.title_pt,
    title_en: badge.title_en,
    earned: earnedIds.has(badge.id),
  }));
}

async function syncBadges(store, accountId, cohortId, sourceModuleId) {
  const courseIds = await store.listCourseIdsForCohort(cohortId);
  const modules = modulesForCourseIds(courseIds);
  const progress = await store.listProgressForAccountCohort(accountId, cohortId);
  const completed = progress.filter((row) => row.status === "completed").length;
  const now = new Date().toISOString();
  if (completed >= 1) {
    await store.grantBadge({
      account_id: accountId,
      cohort_id: cohortId,
      badge_id: "primeiro_passo",
      source_module_id: sourceModuleId,
      earned_at: now,
    });
  } else {
    await store.revokeBadge(accountId, cohortId, "primeiro_passo");
  }
  if (modules.length > 0 && completed === modules.length) {
    await store.grantBadge({
      account_id: accountId,
      cohort_id: cohortId,
      badge_id: "trilha_concluida",
      source_module_id: sourceModuleId,
      earned_at: now,
    });
  } else {
    await store.revokeBadge(accountId, cohortId, "trilha_concluida");
  }
}

async function requireCohort(store, cohortId) {
  if (!z.string().uuid().safeParse(cohortId).success) throw new ServiceError(404, "not_found");
  const cohort = await store.findCohortById(cohortId);
  if (!cohort) throw new ServiceError(404, "not_found");
  return cohort;
}

async function assertCanRead(store, actor, cohortId) {
  const cohort = await requireCohort(store, cohortId);
  const membership = await store.findMembership(cohort.id, actor.id);
  if (actor.role !== "admin" && !membership) throw new ServiceError(404, "not_found");
  return { cohort, membership };
}

async function overview(store) {
  const accounts = await store.listAccounts();
  const cohorts = await store.listCohorts();
  const byRole = { learner: 0, instructor: 0, admin: 0 };
  for (const account of accounts) {
    if (account.status === "active" && byRole[account.role] != null) byRole[account.role] += 1;
  }
  return {
    production_ready: false,
    cohort_count: cohorts.length,
    active_accounts: byRole,
  };
}

module.exports = {
  ServiceError,
  publicAccount,
  authenticate,
  actorFromToken,
  createAccount,
  disableAccount,
  createCohort,
  addMember,
  assignCourse,
  visibleCohorts,
  readCohort,
  completeModule,
  insightsFor,
  overview,
};
