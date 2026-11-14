"use strict";

/**
 * Locale guard for user-facing copy in the learning slice.
 *
 * Targets, with zero tolerance for listed deviations:
 * - Portuguese: Angolan usage (PT-AO) under the 1990 orthographic agreement
 *   (AO90), which Angola applies. No Brazilian vocabulary, no pre-1990
 *   spelling, no English words left in Portuguese copy.
 * - English: US spelling and usage (en-US). No British spellings, no
 *   Portuguese text.
 * - French: France French (fr-FR). No Canadian or Belgian or Swiss forms.
 *
 * A word list cannot prove that copy is idiomatic. Native review by Angolan,
 * US, and French-speaking-France reviewers is still required before any
 * release. This test only stops listed deviations from returning.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { listCourses, listBadges } = require("../learning/catalog");
const { listAdapters } = require("../cubeshackles/adapters");
const { MESSAGES } = require("../learning/http");
const { CLOSED_FR, learningStatus } = require("../learning/gates");
const { SYNTHETIC_ACCOUNTS, SYNTHETIC_COHORT } = require("../learning/synthetic-seed");

const ROOT = path.join(__dirname, "..", "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (words) =>
  new RegExp(`(?<!\\p{L})(?:${words.map(escapeRe).join("|")})(?!\\p{L})`, "iu");

const PT_BRAZILIAN = wordRe([
  "senha",
  "senhas",
  "celular",
  "celulares",
  "tela",
  "telas",
  "você",
  "vocês",
  "usuário",
  "usuários",
  "arquivo",
  "arquivos",
  "equipe",
  "equipes",
  "cadastro",
  "cadastrar",
  "cadastrado",
  "deletar",
  "gerenciar",
  "gerenciamento",
  "ônibus",
  "registro",
  "trilha",
  "trilhas",
  "aprovisiona",
  "aprovisionar",
  "aprovisionamento",
  "contato",
  "contatos",
  "salvar",
  "tudo bem",
  "a gente",
  "aprendiz",
  "aprendizes",
  "instrutor",
  "instrutores",
  "coorte",
  "coortes",
]);

const PT_PRE_AO90 = wordRe([
  "actual",
  "projecto",
  "objectivo",
  "acção",
  "acções",
  "direcção",
  "recepção",
  "óptimo",
  "aspecto",
  "pára",
  "pêlo",
  "sector",
]);

const PT_ENGLISH = wordRe([
  "developer",
  "developers",
  "admin",
  "learner",
  "learners",
  "instructor",
  "instructors",
  "cohort",
  "cohorts",
  "badge",
  "badges",
  "track",
  "tracks",
  "role",
  "roles",
  "callable",
  "cookie",
  "unconfigured",
  "reference_only",
  "not_accessible",
  "production",
  "pilot",
  "demo",
  "server",
  "client",
  "email",
  "password",
  "username",
  "login",
  "logout",
  "sign in",
  "log out",
  "synthetic",
  "endpoint",
  "commit",
  "commitados",
  "provision",
  "dashboard",
  "setup",
  "online",
  "offline",
  "display name",
  "adapter",
]);

const EN_BRITISH = wordRe([
  "programme",
  "organisation",
  "organisations",
  "organise",
  "organised",
  "authorise",
  "authorised",
  "authorisation",
  "colour",
  "colours",
  "behaviour",
  "centre",
  "licence",
  "learnt",
  "enrol",
  "enrolment",
  "favour",
  "catalogue",
  "recognise",
  "analyse",
  "utilise",
  "realise",
  "minimise",
  "prioritise",
  "summarise",
  "whilst",
  "practise",
  "cheque",
  "judgement",
  "or over",
  "e-mail",
]);

const FR_NON_FRANCE = wordRe([
  "courriel",
  "courriels",
  "magasiner",
  "clavarder",
  "souper",
  "septante",
  "nonante",
  "octante",
  "huitante",
  "fin de semaine",
  "stationnement",
  "dépanneur",
  "cellulaire",
  "chum",
]);

const PT_MARKERS =
  /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]|(?<!\p{L})(?:não|para|uma|pelo|pela|sem|são|está|estão|este|esta|ainda|pessoas|dados|conta|turma|sessão)(?!\p{L})/iu;

const PROPER_NOUNS = /GitHub App|GitHub|CubeShackles|BIU\.G Academy|Academy/g;

function assertNoMatch(re, value, label) {
  const stripped = value.replace(PROPER_NOUNS, "");
  const found = stripped.match(re);
  assert.equal(found, null, `${label}: "${found && found[0]}" in "${value}"`);
}

function assertPt(value, label) {
  assertNoMatch(PT_BRAZILIAN, value, `${label} [Brazilian PT]`);
  assertNoMatch(PT_PRE_AO90, value, `${label} [pre-AO90 PT]`);
  assertNoMatch(PT_ENGLISH, value, `${label} [English in PT]`);
}

function assertEn(value, label) {
  assertNoMatch(EN_BRITISH, value, `${label} [British EN]`);
  assert.equal(PT_MARKERS.test(value), false, `${label} [Portuguese in EN]: "${value}"`);
}

function assertFr(value, label) {
  assertNoMatch(FR_NON_FRANCE, value, `${label} [non-France FR]`);
}

function languageOfKey(key) {
  if (/_pt$/.test(key)) return "pt";
  if (/_en$/.test(key)) return "en";
  if (/_fr$/.test(key)) return "fr";
  return null;
}

function check(lang, value, label) {
  if (lang === "pt") assertPt(value, label);
  if (lang === "en") assertEn(value, label);
  if (lang === "fr") assertFr(value, label);
}

function walkStrings(node, visit, key = "") {
  if (typeof node === "string") return visit(key, node);
  if (Array.isArray(node)) return node.forEach((item) => walkStrings(item, visit, key));
  if (node && typeof node === "object") {
    for (const [childKey, child] of Object.entries(node)) walkStrings(child, visit, childKey);
  }
  return undefined;
}

function assertPairs(node, label) {
  if (Array.isArray(node)) return node.forEach((item) => assertPairs(item, label));
  if (!node || typeof node !== "object") return;
  for (const key of Object.keys(node)) {
    if (!key.endsWith("_pt")) continue;
    const twin = `${key.slice(0, -3)}_en`;
    assert.equal(typeof node[twin], "string", `${label}: ${key} has no ${twin}`);
    assert.ok(node[twin].length > 0, `${label}: ${twin} is empty`);
  }
  for (const value of Object.values(node)) assertPairs(value, label);
  return undefined;
}

function extractPairs(source) {
  const pattern = /text\(\s*"((?:[^"\\\n]|\\.)*)"\s*,\s*"((?:[^"\\\n]|\\.)*)"\s*\)/g;
  const pairs = [];
  let match;
  while ((match = pattern.exec(source)) !== null) pairs.push([match[1], match[2]]);
  return pairs;
}

function extractLiterals(source) {
  const pattern = /"((?:[^"\\\n]|\\.)*)"/g;
  const literals = [];
  let match;
  while ((match = pattern.exec(source)) !== null) literals.push(match[1]);
  return literals;
}

function htmlTextNodes(html) {
  const withoutHead = html.replace(/<head[\s\S]*?<\/head>/i, "");
  const withoutScripts = withoutHead.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  const englishNodes = [];
  const body = withoutScripts.replace(
    /<([a-z0-9]+)([^>]*)\slang="en-US"[^>]*>([\s\S]*?)<\/\1>/gi,
    (_match, _tag, _attrs, inner) => {
      englishNodes.push(inner.replace(/<[^>]+>/g, " ").trim());
      return " ";
    }
  );
  const portugueseNodes = body
    .split(/<[^>]+>/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return { englishNodes, portugueseNodes };
}

describe("PT-AO copy has no Brazilian, pre-AO90, or English leakage", () => {
  it("catalog, badges, and adapters pair every Portuguese string with English", () => {
    const pairs = { courses: listCourses(), badges: listBadges(), adapters: listAdapters() };
    assertPairs(pairs, "catalog");
  });

  it("every Portuguese string in the learning API is PT-AO", () => {
    let count = 0;
    const visit = (key, value) => {
      const lang = languageOfKey(key);
      if (lang !== "pt") return;
      count += 1;
      assertPt(value, key);
    };
    walkStrings({ courses: listCourses(), badges: listBadges(), adapters: listAdapters() }, visit);
    walkStrings(learningStatus({}), visit);
    for (const [key, [pt]] of Object.entries(MESSAGES)) {
      count += 1;
      assertPt(pt, `message ${key}`);
    }
    for (const account of SYNTHETIC_ACCOUNTS) {
      count += 1;
      assertPt(account.display_name, `synthetic ${account.login_name}`);
    }
    for (const field of ["name", "summary"]) {
      count += 1;
      assertPt(SYNTHETIC_COHORT[field], `synthetic cohort ${field}`);
    }
    assert.ok(count > 40, `expected to scan many Portuguese strings, scanned ${count}`);
  });

  it("the client's Portuguese strings are PT-AO", () => {
    const source = read("portal/learn/learn.js");
    const pairs = extractPairs(source);
    assert.ok(pairs.length >= 50, `expected many text() pairs, found ${pairs.length}`);
    for (const [pt, en] of pairs) {
      assertPt(pt, `learn.js pt "${pt}"`);
      assertEn(en, `learn.js en "${en}"`);
    }
    for (const literal of extractLiterals(source)) {
      if (PT_MARKERS.test(literal)) assertPt(literal, `learn.js literal "${literal}"`);
      else assertEn(literal, `learn.js literal "${literal}"`);
    }
  });

  it("the client renders role, track, and tool status as words, not codes", () => {
    const source = read("portal/learn/learn.js");
    for (const role of ["learner", "instructor", "admin"]) {
      assert.match(source, new RegExp(`\\b${role}:\\s*\\{\\s*pt:`), `ROLE label for ${role}`);
    }
    for (const track of ["developer", "nondeveloper"]) {
      assert.match(source, new RegExp(`\\b${track}:\\s*\\{\\s*pt:`), `TRACK label for ${track}`);
    }
    for (const adapter of listAdapters()) {
      assert.match(
        source,
        new RegExp(`\\b${adapter.status}:\\s*\\{\\s*pt:`),
        `TOOL_STATUS label for ${adapter.status}`
      );
    }
  });

  it("the client sets document language to PT-AO or US English", () => {
    const source = read("portal/learn/learn.js");
    assert.match(source, /lang === "en" \? "en-US" : "pt-AO"/);
  });
});

describe("EN copy is US English", () => {
  it("every English string in the learning API is US English", () => {
    let count = 0;
    const visit = (key, value) => {
      if (languageOfKey(key) !== "en") return;
      count += 1;
      assertEn(value, key);
    };
    walkStrings({ courses: listCourses(), badges: listBadges(), adapters: listAdapters() }, visit);
    walkStrings(learningStatus({}), visit);
    for (const [key, [, en]] of Object.entries(MESSAGES)) {
      count += 1;
      assertEn(en, `message ${key}`);
    }
    assert.ok(count > 40, `expected to scan many English strings, scanned ${count}`);
  });
});

describe("FR copy is France French", () => {
  it("the only French closure sentence is the approved France French wording", () => {
    assert.equal(CLOSED_FR, "Les candidatures ne sont pas encore ouvertes.");
    assertFr(CLOSED_FR, "CLOSED_FR");
    assert.equal(learningStatus({}).message_fr, CLOSED_FR);
  });
});

describe("static learning page", () => {
  it("declares PT-AO as the page language", () => {
    const html = read("portal/learn/index.html");
    assert.match(html, /<html lang="pt-AO">/);
  });

  it("keeps every non-Portuguese text node inside an en-US span and passes both rules", () => {
    const html = read("portal/learn/index.html");
    const { englishNodes, portugueseNodes } = htmlTextNodes(html);
    assert.ok(englishNodes.length >= 2, "expected the approved English closure and noscript text");
    for (const node of englishNodes) assertEn(node, `learn/index.html en-US span "${node}"`);
    const allowed = new Set(["BIU.G Academy", "PT", "EN"]);
    for (const node of portugueseNodes) {
      if (allowed.has(node)) continue;
      assertPt(node, `learn/index.html text "${node}"`);
    }
  });

  it("the language switch is labeled in Portuguese", () => {
    const html = read("portal/learn/index.html");
    assert.match(html, /aria-label="Idioma"/);
  });
});
