"use strict";

/**
 * Local curriculum for the two pilot tracks.
 * Completion is a checklist acknowledgement stored as a progress row.
 * Free text is not collected.
 */

const BADGES = [
  {
    id: "primeiro_passo",
    title_pt: "Primeiro passo",
    title_en: "First step",
    rule: "Earned when the learner has completed at least one assigned module in that cohort.",
  },
  {
    id: "trilha_concluida",
    title_pt: "Trilha concluída",
    title_en: "Track completed",
    rule: "Earned only when the cohort has at least one assigned module and the learner has completed every module currently assigned. Removed from the earned set if a later assignment makes that untrue.",
  },
];

const COURSES = [
  {
    id: "dev-cubeshackles-orientation",
    track: "developer",
    title_pt: "Orientação CubeShackles para developers",
    title_en: "CubeShackles orientation for developers",
    summary_pt: "Leitura do que está publicado e do que ainda não está ligado. Sem chamada a APIs.",
    summary_en: "Read what is published and what is not connected yet. No API calls.",
    modules: [
      {
        id: "dev-github-app-notes",
        title_pt: "Notas públicas da GitHub App",
        title_en: "Public GitHub App notes",
        summary_pt:
          "Confirmar as propriedades escritas no perfil público CubeShackles/.github. Isto não cria uma instalação nem um token.",
        summary_en:
          "Confirm the properties written in the public CubeShackles/.github profile. This does not create an installation or a token.",
        exercise: {
          kind: "local_checklist",
          reference_adapter: "github-app-operating-notes",
          items: [
            {
              id: "app_identity",
              label_pt: "A autenticação prevista usa a identidade da GitHub App.",
              label_en: "Expected authentication uses the GitHub App identity.",
            },
            {
              id: "installation_scoped",
              label_pt: "A autorização é limitada à instalação.",
              label_en: "Authorization is scoped to the installation.",
            },
            {
              id: "short_lived_tokens",
              label_pt: "Os tokens de acesso da instalação são de curta duração.",
              label_en: "Installation access tokens are short-lived.",
            },
            {
              id: "explicit_repo_selection",
              label_pt: "A seleção de repositórios é explícita.",
              label_en: "Repository selection is explicit.",
            },
            {
              id: "minimum_permissions",
              label_pt: "As permissões pedidas são as mínimas necessárias.",
              label_en: "Requested permissions are the minimum required.",
            },
            {
              id: "no_secrets_in_repo",
              label_pt: "Segredos não são commitados no repositório.",
              label_en: "Secrets are not committed to the repository.",
            },
          ],
        },
      },
      {
        id: "dev-tool-boundary",
        title_pt: "Limite das ferramentas",
        title_en: "Tool boundary",
        summary_pt:
          "Registar que o adaptador de ferramentas está desligado. Nenhuma chamada externa é sucesso.",
        summary_en: "Record that the tool adapter is disabled. No external call counts as success.",
        exercise: {
          kind: "local_checklist",
          reference_adapter: "tool-api",
          items: [
            {
              id: "tools_unconfigured",
              label_pt: "O adaptador de API de ferramentas está não configurado.",
              label_en: "The tool API adapter is unconfigured.",
            },
            {
              id: "no_live_call",
              label_pt: "Nenhuma chamada externa deve ser tratada como sucesso.",
              label_en: "No external call should be treated as success.",
            },
            {
              id: "not_production",
              label_pt: "Este exercício local não é acesso de produção à CubeShackles.",
              label_en: "This local exercise is not production access to CubeShackles.",
            },
          ],
        },
      },
    ],
  },
  {
    id: "dev-review-checklist",
    track: "developer",
    title_pt: "Revisão curta do limite",
    title_en: "Short boundary review",
    summary_pt: "Um módulo extra para a turma developer. Não liga ferramentas.",
    summary_en: "One extra module for the developer track. It does not connect tools.",
    modules: [
      {
        id: "dev-review-one",
        title_pt: "Continua local",
        title_en: "Still local",
        summary_pt: "Confirmar de novo que o exercício é local.",
        summary_en: "Confirm again that the exercise is local.",
        exercise: {
          kind: "local_checklist",
          reference_adapter: "tool-api",
          items: [
            {
              id: "still_local",
              label_pt: "Este módulo continua a ser um exercício local, sem API CubeShackles.",
              label_en: "This module is still a local exercise, with no CubeShackles API.",
            },
          ],
        },
      },
    ],
  },
  {
    id: "access-cubeshackles-orientation",
    track: "nondeveloper",
    title_pt: "Acesso prático para quem não desenvolve",
    title_en: "Practical access for non-developers",
    summary_pt:
      "O que uma pessoa pode perceber e usar hoje, sem ferramentas ligadas e sem enviar dados pessoais.",
    summary_en:
      "What a person can understand and use today, with no connected tools and no personal-data submission.",
    modules: [
      {
        id: "access-what-is-public",
        title_pt: "O que está público",
        title_en: "What is public",
        summary_pt:
          "Ler o perfil público e separar descrição institucional de disponibilidade comercial.",
        summary_en:
          "Read the public profile and separate an institutional description from commercial availability.",
        exercise: {
          kind: "local_checklist",
          reference_adapter: "github-app-operating-notes",
          items: [
            {
              id: "pre_production",
              label_pt: "O perfil público descreve a CubeShackles como pré-produção.",
              label_en: "The public profile describes CubeShackles as pre-production.",
            },
            {
              id: "angola_origin",
              label_pt:
                "A origem descrita é Angola, com a organização GitHub operada a partir dos Estados Unidos.",
              label_en:
                "The described origin is Angola, with the GitHub organization operated from the United States.",
            },
            {
              id: "not_regulatory_approval",
              label_pt: "O perfil não é aprovação regulatória nem disponibilidade comercial.",
              label_en: "The profile is not regulatory approval or commercial availability.",
            },
          ],
        },
      },
      {
        id: "access-safe-use",
        title_pt: "Uso seguro deste piloto",
        title_en: "Safe use of this pilot",
        summary_pt:
          "Limites do piloto de aprendizagem. Não abre candidaturas nem recolhe documentos.",
        summary_en:
          "Limits of the learning pilot. It does not open applications or collect documents.",
        exercise: {
          kind: "local_checklist",
          reference_adapter: "sso",
          items: [
            {
              id: "age_18",
              label_pt: "O piloto da Academy é apenas para pessoas com 18 anos ou mais.",
              label_en: "The Academy pilot is only for people aged 18 or over.",
            },
            {
              id: "no_personal_documents",
              label_pt: "Não envio documentos pessoais por este canal.",
              label_en: "I do not send personal documents through this channel.",
            },
            {
              id: "applications_closed",
              label_pt: "As candidaturas ainda não estão abertas.",
              label_en: "Applications are not open yet.",
            },
            {
              id: "tools_not_connected",
              label_pt: "As ferramentas CubeShackles desta página não estão ligadas.",
              label_en: "The CubeShackles tools on this page are not connected.",
            },
          ],
        },
      },
    ],
  },
];

function listCourses() {
  return COURSES.map((course) => ({
    ...course,
    modules: course.modules.map((mod) => ({
      ...mod,
      exercise: {
        ...mod.exercise,
        items: mod.exercise.items.map((item) => ({ ...item })),
      },
    })),
  }));
}

function getCourse(id) {
  return listCourses().find((course) => course.id === id) || null;
}

function getModule(moduleId) {
  for (const course of COURSES) {
    const found = course.modules.find((mod) => mod.id === moduleId);
    if (found)
      return {
        course: getCourse(course.id),
        module: getCourse(course.id).modules.find((mod) => mod.id === moduleId),
      };
  }
  return null;
}

function listBadges() {
  return BADGES.map((badge) => ({ ...badge }));
}

function modulesForCourseIds(courseIds) {
  const modules = [];
  for (const courseId of courseIds) {
    const course = getCourse(courseId);
    if (course) modules.push(...course.modules);
  }
  return modules;
}

module.exports = {
  BADGES,
  listCourses,
  getCourse,
  getModule,
  listBadges,
  modulesForCourseIds,
};
