"use strict";

/**
 * CubeShackles integration inventory used by the learning service.
 *
 * Observed on 2026-11-07 with the credentials available to this review:
 * - https://github.com/CubeShackles/.github is a public organization profile.
 *   It documents a GitHub App operating model. It is not a learner SSO and
 *   not a tool-execution API.
 * - https://github.com/CubeShackles/cubeshackles returned HTTP 404 to the
 *   unauthenticated GitHub API and to github.com. Sibling repositories are
 *   described as private during pre-production. Their contracts were not read.
 *
 * No adapter in this module performs network I/O. Setting an environment URL
 * does not enable a call. A future contract has to be pinned in reviewed code.
 */

const ADAPTERS = [
  {
    id: "github-app-operating-notes",
    kind: "public_document",
    status: "reference_only",
    callable: false,
    evidence_url: "https://github.com/CubeShackles/.github",
    observed: "Public organization profile and GitHub App operating notes, read 2026-11-07.",
    label_pt: "Notas públicas da GitHub App",
    label_en: "Public GitHub App notes",
    detail_pt:
      "Documento público de referência. Não inicia sessão e não executa ferramentas CubeShackles.",
    detail_en:
      "Public reference document. It does not sign anyone in and does not execute CubeShackles tools.",
  },
  {
    id: "umbrella-repository",
    kind: "repository",
    status: "not_accessible",
    callable: false,
    evidence_url: "https://github.com/CubeShackles/cubeshackles",
    observed:
      "HTTP 404 to the unauthenticated GitHub API and to github.com on 2026-11-07. Not evidence that the repository is empty.",
    label_pt: "Repositório umbrella",
    label_en: "Umbrella repository",
    detail_pt:
      "O contrato umbrella não ficou acessível nesta revisão. Nenhum endpoint foi inferido.",
    detail_en: "The umbrella contract was not accessible in this review. No endpoint was inferred.",
  },
  {
    id: "tool-api",
    kind: "http_api",
    status: "unconfigured",
    callable: false,
    evidence_url: null,
    observed: "No verified tool API contract is pinned in this repository.",
    label_pt: "API de ferramentas",
    label_en: "Tool API",
    detail_pt:
      "Adaptador desativado. URLs de ambiente são ignoradas e nenhuma chamada externa é feita.",
    detail_en: "Adapter disabled. Environment URLs are ignored and no external call is made.",
  },
  {
    id: "sso",
    kind: "sso",
    status: "unconfigured",
    callable: false,
    evidence_url: null,
    observed: "No CubeShackles SSO or OAuth contract was available to this review.",
    label_pt: "Início de sessão CubeShackles",
    label_en: "CubeShackles sign-in",
    detail_pt: "Não existe SSO configurado. A única sessão é a cookie local da Academy.",
    detail_en: "No SSO is configured. The only session is the Academy local cookie.",
  },
];

function listAdapters() {
  return ADAPTERS.map((adapter) => ({ ...adapter }));
}

function getAdapter(id) {
  return listAdapters().find((adapter) => adapter.id === id) || null;
}

/**
 * Always refuses. The signature accepts a fetch implementation so tests can
 * prove it is never invoked, including when a base URL is present in env.
 */
async function callAdapter(id, deps = {}) {
  const adapter = getAdapter(id);
  void deps.fetch;
  void deps.env;
  return {
    ok: false,
    status: 503,
    body: {
      ok: false,
      called: false,
      adapter_id: id,
      adapter_status: adapter ? adapter.status : "unknown",
      callable: false,
      production_ready: false,
      ignored_base_url: Boolean(deps.env && deps.env.CUBESHACKLES_TOOL_BASE_URL),
      message_pt: "Adaptador CubeShackles não configurado. Nenhuma chamada externa foi feita.",
      message_en: "CubeShackles adapter is not configured. No external call was made.",
    },
  };
}

module.exports = {
  listAdapters,
  getAdapter,
  callAdapter,
};
