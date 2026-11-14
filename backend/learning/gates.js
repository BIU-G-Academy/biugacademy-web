"use strict";

/**
 * Release gates for personal data and account provisioning.
 *
 * Personal-data intake is hard-closed in this build. Environment variables
 * cannot reopen it. A later review must change this code after a privacy
 * architecture and qualified Angolan counsel opinion exist.
 *
 * Real account provisioning is also unavailable. The only account-creation
 * mode is an explicit non-production synthetic demo.
 */

const CLOSED_PT = "As candidaturas ainda não estão abertas.";
const CLOSED_EN = "Applications are not open yet.";
const CLOSED_FR = "Les candidatures ne sont pas encore ouvertes.";

function personalIntakeOpen(_env) {
  return false;
}

function counselReference(env) {
  return String(env.ACADEMY_COUNSEL_REVIEW_REFERENCE || "").trim();
}

function provisioningMode(env) {
  const production = env.NODE_ENV === "production";
  const syntheticRequested =
    env.ACADEMY_SYNTHETIC_DEMO === "1" && env.ACADEMY_ACCOUNT_PROVISIONING === "synthetic-local";
  if (!production && syntheticRequested) return "synthetic-local";
  return "closed";
}

function intakeClosedBody() {
  return {
    ok: false,
    success: false,
    intake: "closed",
    persisted: false,
    production_ready: false,
    message_pt: CLOSED_PT,
    message_en: CLOSED_EN,
    message_fr: CLOSED_FR,
  };
}

function supportClosedBody() {
  return {
    ok: false,
    success: false,
    intake: "closed",
    persisted: false,
    production_ready: false,
    message_pt: "Este canal não está a receber dados pessoais.",
    message_en: "This channel is not accepting personal data.",
  };
}

function learningStatus(env) {
  const provisioning = provisioningMode(env);
  return {
    ok: true,
    service: "biug-academy-learning",
    production_ready: false,
    personal_data_intake: "closed",
    account_provisioning: provisioning,
    synthetic_demo: provisioning === "synthetic-local",
    cubeshackles_tools: "unconfigured",
    pilot_minimum_age: 18,
    message_pt: CLOSED_PT,
    message_en: CLOSED_EN,
    message_fr: CLOSED_FR,
    mission_note_pt:
      "A aspiração de longo prazo é chegar a pelo menos 12 milhões de africanos. Isto não é adoção alcançada nem capacidade verificada.",
    mission_note_en:
      "The long-term aspiration is to reach at least 12 million Africans. This is not achieved adoption or verified capacity.",
    counsel_reference_recorded: counselReference(env).length > 0,
  };
}

module.exports = {
  CLOSED_PT,
  CLOSED_EN,
  CLOSED_FR,
  personalIntakeOpen,
  provisioningMode,
  intakeClosedBody,
  supportClosedBody,
  learningStatus,
};
