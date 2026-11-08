"use strict";

const lang = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "pt";
const text = (pt, en) => (lang === "en" ? en : pt);
const message = (data) =>
  (data &&
    (lang === "en" ? data.message_en || data.message_pt : data.message_pt || data.message_en)) ||
  text("Pedido falhou.", "Request failed.");

const state = {
  status: null,
  account: null,
  cohorts: [],
  tools: [],
  catalog: [],
  accounts: [],
  overview: null,
  cohort: null,
  insights: null,
  error: "",
  offline: false,
};

function h(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, String(value));
  });
  [].concat(children || []).forEach((child) => {
    if (child == null || child === false) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function field(id, label, type, extra) {
  return [
    h("label", { for: id }, label),
    h("input", Object.assign({ id, name: id, type, required: true }, extra || {})),
  ];
}

async function api(path, options) {
  const opts = options || {};
  const headers = { Accept: "application/json" };
  if (opts.method && opts.method !== "GET") headers["X-BIUG-Client"] = "academy";
  if (opts.body) headers["Content-Type"] = "application/json";
  const response = await fetch(path, {
    method: opts.method || "GET",
    headers,
    credentials: "same-origin",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    data = { message_pt: "Resposta inválida.", message_en: "Invalid response." };
  }
  return { ok: response.ok, status: response.status, data };
}

function notice(status) {
  const mission = status
    ? lang === "en"
      ? status.mission_note_en
      : status.mission_note_pt
    : text(
        "A aspiração de longo prazo é chegar a pelo menos 12 milhões de africanos. Isto não é adoção alcançada nem capacidade verificada.",
        "The long-term aspiration is to reach at least 12 million Africans. This is not achieved adoption or verified capacity."
      );
  return h("section", { class: "banner", id: "status-banner" }, [
    h("p", null, [h("strong", null, "As candidaturas ainda não estão abertas.")]),
    h("p", null, [h("strong", null, "Applications are not open yet.")]),
    h("p", null, mission),
    h(
      "p",
      null,
      text(
        "Piloto apenas para pessoas com 18 anos ou mais. Não está pronto para produção.",
        "Pilot for people aged 18 or over only. Not production-ready."
      )
    ),
    status && status.synthetic_demo
      ? h(
          "p",
          null,
          text(
            "Demonstração sintética em memória. Não aprovisiona pessoas reais e desaparece quando o processo pára.",
            "In-memory synthetic demonstration. It does not provision real people and disappears when the process stops."
          )
        )
      : null,
    status
      ? h(
          "p",
          { class: "muted" },
          text("Ferramentas CubeShackles: ", "CubeShackles tools: ") +
            (status.cubeshackles_tools || "unconfigured")
        )
      : null,
  ]);
}

function renderError() {
  return state.error ? h("div", { class: "error", id: "error" }, state.error) : null;
}

function renderLogin() {
  const form = h("form", { id: "login-form" }, [
    ...field("login-name", text("Identificador", "Login"), "text", {
      autocomplete: "username",
      autocapitalize: "none",
    }),
    ...field("password", text("Palavra-passe", "Password"), "password", {
      autocomplete: "current-password",
    }),
    h("div", { class: "row" }, [
      h("button", { id: "login-submit", type: "submit" }, text("Entrar", "Sign in")),
    ]),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.error = "";
    const result = await api("/api/auth/login", {
      method: "POST",
      body: {
        login_name: form.querySelector("#login-name").value.trim(),
        password: form.querySelector("#password").value,
      },
    });
    if (!result.ok) {
      state.error = message(result.data);
      render();
      return;
    }
    state.account = result.data.account;
    await loadHome();
  });
  return h("section", { class: "card", id: "login-card" }, [
    h("h1", null, text("Entrar", "Sign in")),
    h(
      "p",
      { class: "muted" },
      text(
        "A sessão é criada no servidor. Esta página não autoriza ninguém sozinha.",
        "The session is created on the server. This page does not authorize anyone by itself."
      )
    ),
    renderError(),
    form,
  ]);
}

function cohortButton(cohort) {
  return h(
    "button",
    {
      class: "secondary",
      type: "button",
      onclick: () => openCohort(cohort.id),
    },
    `${cohort.name} · ${cohort.track}`
  );
}

function renderTools() {
  return h("section", { class: "panel", id: "tool-list" }, [
    h("h2", null, text("Ferramentas CubeShackles", "CubeShackles tools")),
    h(
      "p",
      { class: "muted" },
      text(
        "Nenhum adaptador está callable. Referências públicas não são uma sessão nem uma API.",
        "No adapter is callable. Public references are not a session or an API."
      )
    ),
    ...state.tools.map((adapter) =>
      h("article", { class: "card" }, [
        h("h3", null, lang === "en" ? adapter.label_en : adapter.label_pt),
        h("span", { class: "pill off" }, adapter.status),
        h("p", null, lang === "en" ? adapter.detail_en : adapter.detail_pt),
        adapter.evidence_url
          ? h(
              "a",
              { href: adapter.evidence_url, rel: "noreferrer" },
              text("Abrir documento público", "Open public document")
            )
          : h("p", { class: "muted" }, text("Sem URL verificada.", "No verified URL.")),
        adapter.kind === "http_api"
          ? h(
              "button",
              {
                type: "button",
                id: "try-tool-call",
                class: "secondary",
                onclick: async () => {
                  const result = await api(`/api/tools/${adapter.id}/call`, {
                    method: "POST",
                    body: {},
                  });
                  state.error = message(result.data);
                  render();
                },
              },
              text("Tentar chamada", "Try call")
            )
          : null,
      ])
    ),
  ]);
}

function renderBadges(badges) {
  return h("div", { id: "badge-list" }, [
    h("h3", null, text("Distintivos", "Badges")),
    ...(badges || []).map((badge) =>
      h(
        "span",
        { class: badge.earned ? "pill ok" : "pill off" },
        `${lang === "en" ? badge.title_en : badge.title_pt}: ${
          badge.earned ? text("conquistado", "earned") : text("por concluir", "not earned")
        }`
      )
    ),
  ]);
}

function renderInsights() {
  const insights = state.insights;
  if (!insights) return null;
  if (insights.scope === "self") {
    const rate =
      insights.module_count > 0
        ? `${insights.my_completed}/${insights.module_count}`
        : text("sem módulos", "no modules");
    return h("section", { class: "panel", id: "insights" }, [
      h("h2", null, text("O meu progresso", "My progress")),
      h("div", { class: "metrics" }, [
        h("div", { class: "metric" }, [text("Concluídos", "Completed"), h("strong", null, rate)]),
        h("div", { class: "metric" }, [
          text("Próximo", "Next"),
          h(
            "strong",
            null,
            insights.next_module
              ? lang === "en"
                ? insights.next_module.title_en
                : insights.next_module.title_pt
              : "—"
          ),
        ]),
      ]),
      renderBadges(insights.badges),
    ]);
  }
  const rate =
    insights.possible_completions > 0
      ? `${insights.completed_count}/${insights.possible_completions}`
      : text("sem dados", "no data");
  return h("section", { class: "panel", id: "insights" }, [
    h("h2", null, text("Leitura da turma", "Cohort insight")),
    h("div", { class: "metrics" }, [
      h("div", { class: "metric" }, [
        text("Aprendizes", "Learners"),
        h("strong", null, String(insights.learner_count)),
      ]),
      h("div", { class: "metric" }, [text("Conclusões", "Completions"), h("strong", null, rate)]),
    ]),
    h(
      "ul",
      null,
      (insights.modules || []).map((mod) =>
        h("li", null, `${lang === "en" ? mod.title_en : mod.title_pt}: ${mod.completed_count}`)
      )
    ),
    h("h3", null, text("Sem progresso ainda", "No progress yet")),
    (insights.stalled_learners || []).length
      ? h(
          "ul",
          null,
          insights.stalled_learners.map((person) => h("li", null, person.display_name))
        )
      : h("p", { class: "muted" }, text("Ninguém nesta lista.", "Nobody on this list.")),
  ]);
}

function renderModules() {
  const detail = state.cohort;
  if (!detail) return null;
  const learner = detail.membership_role === "learner";
  const blocks = [];
  (detail.courses || []).forEach((course) => {
    blocks.push(h("h3", null, lang === "en" ? course.title_en : course.title_pt));
    course.modules.forEach((mod) => {
      const form = h("form", { id: `module-${mod.id}` }, [
        h("p", null, lang === "en" ? mod.summary_en : mod.summary_pt),
        ...(mod.exercise.items || []).map((item) =>
          h("label", { class: "check" }, [
            h("input", { type: "checkbox", value: item.id, disabled: mod.completed ? true : null }),
            lang === "en" ? item.label_en : item.label_pt,
          ])
        ),
        learner && !mod.completed
          ? h("div", { class: "row" }, [
              h(
                "button",
                {
                  type: "submit",
                  id: mod.id === detail.courses[0].modules[0].id ? "complete-module" : null,
                },
                text("Concluir módulo", "Complete module")
              ),
            ])
          : h(
              "p",
              { class: "muted" },
              mod.completed
                ? text("Concluído no servidor.", "Completed on the server.")
                : text(
                    "Só o aprendiz marca o próprio progresso.",
                    "Only the learner records their own progress."
                  )
            ),
      ]);
      if (learner && !mod.completed) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const checklist = [...form.querySelectorAll("input:checked")].map((input) => input.value);
          const result = await api(`/api/cohorts/${detail.cohort.id}/modules/${mod.id}/complete`, {
            method: "POST",
            body: { checklist },
          });
          if (!result.ok) {
            state.error = message(result.data);
            render();
            return;
          }
          state.error = "";
          state.insights = result.data;
          await openCohort(detail.cohort.id);
        });
      }
      blocks.push(
        h("article", { class: "card" }, [
          h("h3", null, lang === "en" ? mod.title_en : mod.title_pt),
          form,
        ])
      );
    });
  });
  return h("section", { id: "module-list" }, blocks);
}

function renderAdminTools() {
  if (!state.account || state.account.role !== "admin" || !state.cohort) return null;
  const cohort = state.cohort.cohort;
  const courseForm = h("form", { id: "assign-course" }, [
    h("label", { for: "course-id" }, text("Atribuir curso", "Assign course")),
    h(
      "select",
      { id: "course-id", name: "course-id", required: true },
      state.catalog
        .filter((course) => course.track === cohort.track)
        .map((course) =>
          h("option", { value: course.id }, lang === "en" ? course.title_en : course.title_pt)
        )
    ),
    h("div", { class: "row" }, [h("button", { type: "submit" }, text("Atribuir", "Assign"))]),
  ]);
  courseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api(`/api/admin/cohorts/${cohort.id}/courses`, {
      method: "POST",
      body: { course_id: courseForm.querySelector("#course-id").value },
    });
    state.error = result.ok ? "" : message(result.data);
    if (result.ok) await openCohort(cohort.id);
    else render();
  });
  const memberForm = h("form", { id: "add-member" }, [
    h("label", { for: "member-id" }, text("Adicionar membro", "Add member")),
    h(
      "select",
      { id: "member-id", required: true },
      state.accounts.map((account) =>
        h("option", { value: account.id }, `${account.display_name} (${account.role})`)
      )
    ),
    h("label", { for: "member-role" }, text("Papel na turma", "Role in cohort")),
    h("select", { id: "member-role" }, [
      h("option", { value: "learner" }, text("Aprendiz", "Learner")),
      h("option", { value: "instructor" }, text("Instrutor", "Instructor")),
    ]),
    h("div", { class: "row" }, [h("button", { type: "submit" }, text("Adicionar", "Add"))]),
  ]);
  memberForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api(`/api/admin/cohorts/${cohort.id}/members`, {
      method: "POST",
      body: {
        account_id: memberForm.querySelector("#member-id").value,
        membership_role: memberForm.querySelector("#member-role").value,
      },
    });
    state.error = result.ok ? "" : message(result.data);
    render();
  });
  return h("section", { class: "panel" }, [
    h("h2", null, text("Atribuições", "Assignments")),
    courseForm,
    memberForm,
  ]);
}

function renderAdminHome() {
  if (!state.account || state.account.role !== "admin") return null;
  const overview = state.overview;
  const form = h("form", { id: "admin-cohort-form" }, [
    ...field("cohort-name", text("Nome da turma", "Cohort name"), "text"),
    ...field("cohort-slug", text("Identificador", "Identifier"), "text", {
      autocapitalize: "none",
    }),
    h("label", { for: "cohort-track" }, text("Trilha", "Track")),
    h("select", { id: "cohort-track" }, [
      h("option", { value: "developer" }, text("Developers", "Developers")),
      h("option", { value: "nondeveloper" }, text("Não developers", "Non-developers")),
    ]),
    h("div", { class: "row" }, [
      h("button", { type: "submit" }, text("Criar turma", "Create cohort")),
    ]),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api("/api/admin/cohorts", {
      method: "POST",
      body: {
        name: form.querySelector("#cohort-name").value.trim(),
        slug: form.querySelector("#cohort-slug").value.trim(),
        track: form.querySelector("#cohort-track").value,
        summary: "",
      },
    });
    if (!result.ok) {
      state.error = message(result.data);
      render();
      return;
    }
    state.error = "";
    await loadHome();
    await openCohort(result.data.cohort.id);
  });
  const accountForm = h("form", { id: "synthetic-account-form" }, [
    h(
      "p",
      { class: "muted" },
      text(
        "Criação sintética local, se o servidor a permitir. Não há campo de e-mail, telefone ou nome legal.",
        "Local synthetic creation, if the server allows it. There is no email, phone, or legal-name field."
      )
    ),
    ...field("new-login", text("Identificador", "Login"), "text", { autocapitalize: "none" }),
    ...field("new-display", text("Nome visível", "Display name"), "text"),
    ...field("new-password", text("Palavra-passe", "Password"), "password", {
      autocomplete: "new-password",
      minlength: 12,
    }),
    h("label", { for: "new-role" }, text("Papel", "Role")),
    h("select", { id: "new-role" }, [
      h("option", { value: "learner" }, text("Aprendiz", "Learner")),
      h("option", { value: "instructor" }, text("Instrutor", "Instructor")),
      h("option", { value: "admin" }, "Admin"),
    ]),
    h("label", { class: "check" }, [
      h("input", { id: "age-18", type: "checkbox" }),
      text(
        "Confirmo que esta conta sintética representa uma pessoa com 18 anos ou mais.",
        "I confirm this synthetic account represents a person aged 18 or over."
      ),
    ]),
    h("div", { class: "row" }, [
      h("button", { type: "submit" }, text("Criar conta sintética", "Create synthetic account")),
    ]),
  ]);
  accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = await api("/api/admin/accounts", {
      method: "POST",
      body: {
        login_name: accountForm.querySelector("#new-login").value.trim(),
        display_name: accountForm.querySelector("#new-display").value.trim(),
        password: accountForm.querySelector("#new-password").value,
        role: accountForm.querySelector("#new-role").value,
        age_attested_18: accountForm.querySelector("#age-18").checked === true,
      },
    });
    state.error = result.ok ? "" : message(result.data);
    if (result.ok) await loadHome();
    else render();
  });
  return h("section", { class: "panel", id: "admin-home" }, [
    h("h2", null, text("Operação", "Operations")),
    overview
      ? h("div", { class: "metrics" }, [
          h("div", { class: "metric" }, [
            text("Turmas", "Cohorts"),
            h("strong", null, String(overview.cohort_count)),
          ]),
          h("div", { class: "metric" }, [
            text("Aprendizes ativos", "Active learners"),
            h("strong", null, String(overview.active_accounts.learner)),
          ]),
        ])
      : null,
    form,
    accountForm,
  ]);
}

function renderHome() {
  return h("section", null, [
    h("div", { class: "row" }, [
      h("p", null, `${state.account.display_name} · ${state.account.role}`),
      h(
        "button",
        {
          id: "logout",
          class: "secondary",
          type: "button",
          onclick: async () => {
            await api("/api/auth/logout", { method: "POST" });
            state.account = null;
            state.cohort = null;
            state.insights = null;
            render();
          },
        },
        text("Sair", "Log out")
      ),
    ]),
    renderError(),
    h("section", { class: "panel", id: "cohort-list" }, [
      h("h2", null, text("Turmas", "Cohorts")),
      state.cohorts.length
        ? h("div", { class: "row" }, state.cohorts.map(cohortButton))
        : h("p", { class: "muted" }, text("Nenhuma turma visível.", "No visible cohort.")),
    ]),
    state.cohort
      ? h("section", { class: "panel" }, [
          h("h2", null, state.cohort.cohort.name),
          h("p", { class: "muted" }, state.cohort.cohort.summary || state.cohort.cohort.track),
          renderInsights(),
          renderModules(),
          renderAdminTools(),
        ])
      : null,
    renderAdminHome(),
    renderTools(),
  ]);
}

function render() {
  const root = document.querySelector("#app");
  root.replaceChildren(
    notice(state.status),
    state.offline
      ? h(
          "section",
          { class: "card", id: "offline" },
          text("Serviço de aprendizagem indisponível.", "Learning service unavailable.")
        )
      : state.account
        ? renderHome()
        : renderLogin()
  );
  document.documentElement.lang = lang === "en" ? "en" : "pt-AO";
}

async function openCohort(id) {
  const [detail, insights] = await Promise.all([
    api(`/api/cohorts/${id}`),
    api(`/api/cohorts/${id}/insights`),
  ]);
  if (!detail.ok) {
    state.error = message(detail.data);
    render();
    return;
  }
  state.cohort = detail.data;
  state.insights = insights.ok ? insights.data : null;
  state.error = "";
  render();
}

async function loadHome() {
  const [cohorts, tools, catalog] = await Promise.all([
    api("/api/cohorts"),
    api("/api/tools"),
    api("/api/catalog/courses"),
  ]);
  if (!cohorts.ok) {
    state.error = message(cohorts.data);
    render();
    return;
  }
  state.cohorts = cohorts.data.cohorts || [];
  state.tools = tools.ok ? tools.data.adapters || [] : [];
  state.catalog = catalog.ok ? catalog.data.courses || [] : [];
  if (state.account.role === "admin") {
    const [overview, accounts] = await Promise.all([
      api("/api/admin/overview"),
      api("/api/admin/accounts"),
    ]);
    state.overview = overview.ok ? overview.data : null;
    state.accounts = accounts.ok ? accounts.data.accounts || [] : [];
  }
  if (!state.cohort && state.cohorts.length === 1) {
    await openCohort(state.cohorts[0].id);
    return;
  }
  render();
}

async function boot() {
  try {
    const status = await api("/api/learning/status");
    if (!status.ok || !status.data || status.data.service !== "biug-academy-learning") {
      state.offline = true;
      render();
      return;
    }
    state.status = status.data;
    const session = await api("/api/auth/session");
    if (session.ok) {
      state.account = session.data.account;
      await loadHome();
      return;
    }
    render();
  } catch (_error) {
    state.offline = true;
    render();
  }
}

boot();
