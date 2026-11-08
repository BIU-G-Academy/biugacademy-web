"use strict";

const { randomUUID } = require("crypto");
const { provisioningMode } = require("./gates");
const { hashPassword } = require("./passwords");

const SYNTHETIC_ACCOUNTS = [
  { login_name: "sint-administrador", display_name: "Administrador sintético", role: "admin" },
  { login_name: "sint-formador", display_name: "Formador sintético", role: "instructor" },
  { login_name: "sint-formando", display_name: "Formando sintético", role: "learner" },
];

const SYNTHETIC_COHORT = {
  slug: "piloto-sintetico",
  name: "Piloto sintético — programação",
  track: "developer",
  summary: "Dados sintéticos em memória. Não é uma turma real.",
};

async function seedSynthetic(store, env) {
  if (provisioningMode(env) !== "synthetic-local") {
    throw new Error(
      "Synthetic seed refused. Set a non-production NODE_ENV, ACADEMY_SYNTHETIC_DEMO=1, and ACADEMY_ACCOUNT_PROVISIONING=synthetic-local."
    );
  }
  const password = String(env.ACADEMY_SYNTHETIC_PASSWORD || "");
  if (password.length < 12 || password.length > 200) {
    throw new Error(
      "ACADEMY_SYNTHETIC_PASSWORD must be 12 to 200 characters and is not given a default."
    );
  }
  const passwordHash = await hashPassword(password);
  const ids = {};
  for (const spec of SYNTHETIC_ACCOUNTS) {
    const existing = await store.findAccountByLogin(spec.login_name);
    if (existing) {
      ids[spec.role] = existing.id;
      continue;
    }
    const created = await store.createAccount({
      id: randomUUID(),
      login_name: spec.login_name,
      password_hash: passwordHash,
      display_name: spec.display_name,
      role: spec.role,
      locale: "pt",
      age_attested_18: true,
      status: "active",
      created_at: new Date().toISOString(),
    });
    ids[spec.role] = created.id;
  }

  let cohort = await store.findCohortBySlug(SYNTHETIC_COHORT.slug);
  if (!cohort) {
    cohort = await store.createCohort({
      id: randomUUID(),
      slug: SYNTHETIC_COHORT.slug,
      name: SYNTHETIC_COHORT.name,
      track: SYNTHETIC_COHORT.track,
      summary: SYNTHETIC_COHORT.summary,
      created_by: ids.admin,
      created_at: new Date().toISOString(),
    });
  }
  const courses = await store.listCourseIdsForCohort(cohort.id);
  if (!courses.includes("dev-cubeshackles-orientation")) {
    await store.assignCourse({ cohort_id: cohort.id, course_id: "dev-cubeshackles-orientation" });
  }
  if (!(await store.findMembership(cohort.id, ids.learner))) {
    await store.addMembership({
      cohort_id: cohort.id,
      account_id: ids.learner,
      membership_role: "learner",
      created_at: new Date().toISOString(),
    });
  }
  if (!(await store.findMembership(cohort.id, ids.instructor))) {
    await store.addMembership({
      cohort_id: cohort.id,
      account_id: ids.instructor,
      membership_role: "instructor",
      created_at: new Date().toISOString(),
    });
  }
  return { cohort_id: cohort.id, logins: SYNTHETIC_ACCOUNTS.map((item) => item.login_name) };
}

module.exports = { seedSynthetic, SYNTHETIC_ACCOUNTS, SYNTHETIC_COHORT };
