/**
 * BIU.G Academy — navigation, first-cohort intake and support.
 *
 * Production data path (first-party, D-015):
 * browser --HTTPS--> BIU.G Academy intake Worker (Cloudflare) --> D1 (contact fields encrypted).
 * No applicant or support payload is sent through a third-party form relay.
 * Until INTAKE_CONFIG is filled in at go-live, forms fail closed (nothing is sent).
 */

(function () {
  "use strict";

  var SUPPORT_EMAIL = "support@biugacademy.org";

  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.querySelector(".nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function detectActiveLanguage(pathname) {
    if (pathname === "/" || pathname === "") return "pt";
    if (pathname.indexOf("/pt") === 0) return "pt";
    if (pathname.indexOf("/en") === 0) return "en";
    if (pathname.indexOf("/fr") === 0) return "fr";
    return "pt";
  }

  function initLanguageSelector() {
    var selectors = document.querySelectorAll(".language-switcher, .lang-switcher");
    if (!selectors.length) return;
    var activeLang = detectActiveLanguage(window.location.pathname || "/");
    selectors.forEach(function (selector) {
      selector.querySelectorAll("a").forEach(function (link) {
        var lang = (link.getAttribute("data-lang") || "").toLowerCase();
        if (!lang) {
          var href = link.getAttribute("href") || "";
          if (href.indexOf("/en/") === 0) lang = "en";
          else if (href.indexOf("/fr/") === 0) lang = "fr";
          else if (href.indexOf("/pt/") === 0) lang = "pt";
        }
        link.classList.toggle("is-active", lang === activeLang);
      });
    });
  }

  /**
   * First-party intake configuration. Both values stay empty until the Founder
   * approves go-live (see docs/operations/intake-first-party.md). While empty,
   * forms fail closed: nothing is sent anywhere and the visitor is shown the
   * support e-mail address instead. Can be overridden per page with
   * <meta name="biug-api-base"> / <meta name="biug-turnstile-sitekey">.
   */
  var INTAKE_CONFIG = {
    apiBase: "", // e.g. "https://intake.biugacademy.org"
    turnstileSiteKey: "",
  };
  var TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

  var MESSAGES = {
    pt: {
      sending: "A enviar...",
      unavailable:
        "O sistema de candidaturas ainda não está ativo nesta página. Nada foi enviado. Escreva para",
      failed: "Não foi possível enviar. Verifique a ligação e tente novamente, ou escreva para",
      invalid: "Verifique os campos assinalados.",
      contact: "Indique pelo menos um contacto: email ou telefone.",
      areas: "Escolha pelo menos uma área de interesse.",
      guardian: "Candidatos com 16 ou 17 anos precisam da autorização do encarregado de educação.",
      verify: "A verificação anti-robô falhou. Tente novamente.",
      rate: "Demasiados envios a partir desta ligação. Tente novamente dentro de uma hora.",
      privacyDone:
        "Pedido recebido. Referência: {ref}. Vamos confirmar a sua identidade pelo contacto indicado antes de agir.",
      supportDone: "Mensagem recebida. A equipa de suporte foi notificada.",
      supportConsent: "Autorizo o tratamento destes dados para responder ao meu pedido.",
      privacyLink: "Aviso de Privacidade",
    },
    en: {
      sending: "Sending...",
      unavailable: "Applications are not live on this page yet. Nothing was sent. Please write to",
      failed: "We could not send this. Check your connection and try again, or write to",
      invalid: "Please check the highlighted fields.",
      contact: "Give at least one contact: email or phone.",
      areas: "Choose at least one area of interest.",
      guardian: "Applicants aged 16 or 17 need a parent or guardian's authorisation.",
      verify: "The anti-bot check failed. Please try again.",
      rate: "Too many submissions from this connection. Please try again in an hour.",
      privacyDone:
        "Request received. Reference: {ref}. We will confirm your identity through the contact you gave before acting.",
      supportDone: "Message received. The support team has been notified.",
      supportConsent: "I authorise the processing of this data to answer my request.",
      privacyLink: "Privacy Notice",
    },
    fr: {
      sending: "Envoi...",
      unavailable:
        "Les candidatures ne sont pas encore actives sur cette page. Rien n'a été envoyé. Écrivez à",
      failed: "L'envoi a échoué. Vérifiez votre connexion et réessayez, ou écrivez à",
      invalid: "Veuillez vérifier les champs signalés.",
      contact: "Indiquez au moins un contact : e-mail ou téléphone.",
      areas: "Choisissez au moins un domaine d'intérêt.",
      guardian: "Les candidats de 16 ou 17 ans ont besoin de l'autorisation d'un parent ou tuteur.",
      verify: "La vérification anti-robot a échoué. Veuillez réessayer.",
      rate: "Trop d'envois depuis cette connexion. Réessayez dans une heure.",
      privacyDone:
        "Demande reçue. Référence : {ref}. Nous confirmerons votre identité par le contact indiqué avant d'agir.",
      supportDone: "Message reçu. L'équipe d'assistance a été notifiée.",
      supportConsent: "J'autorise le traitement de ces données pour répondre à ma demande.",
      privacyLink: "Avis de confidentialité",
    },
  };

  function lang() {
    return detectActiveLanguage(window.location.pathname || "/");
  }

  function t(key) {
    var table = MESSAGES[lang()] || MESSAGES.pt;
    return table[key] || MESSAGES.pt[key] || key;
  }

  function privacyPath() {
    var l = lang();
    if (l === "en") return "/en/privacy/";
    if (l === "fr") return "/fr/confidentialite/";
    return "/pt/privacidade/";
  }

  function thankYouPath() {
    var l = lang();
    if (l === "en") return "/en/thank-you/";
    if (l === "fr") return "/fr/candidature-recue/";
    return "/pt/candidatura-recebida/";
  }

  function metaContent(name) {
    var tag = document.querySelector('meta[name="' + name + '"]');
    return tag ? tag.getAttribute("content") || "" : "";
  }

  function resolveApiBase() {
    var base = metaContent("biug-api-base") || window.BIUG_API_BASE || INTAKE_CONFIG.apiBase || "";
    base = String(base).replace(/\/+$/, "");
    // HTTPS only: never send personal data over plain HTTP.
    return base.indexOf("https://") === 0 ? base : "";
  }

  function turnstileSiteKey() {
    return (
      metaContent("biug-turnstile-sitekey") ||
      window.BIUG_TURNSTILE_SITEKEY ||
      INTAKE_CONFIG.turnstileSiteKey ||
      ""
    );
  }

  function intakeReady() {
    return !!(resolveApiBase() && turnstileSiteKey());
  }

  var turnstileQueue = null;

  function withTurnstile(cb) {
    if (window.turnstile && window.turnstile.render) return cb(window.turnstile);
    if (turnstileQueue) return turnstileQueue.push(cb);
    turnstileQueue = [cb];
    var script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = function () {
      var q = turnstileQueue || [];
      turnstileQueue = [];
      q.forEach(function (fn) {
        fn(window.turnstile);
      });
    };
    document.head.appendChild(script);
  }

  function mountTurnstile(form, action) {
    var slot = form.querySelector("[data-turnstile-slot]");
    if (!slot || !intakeReady()) return;
    withTurnstile(function (ts) {
      if (slot.getAttribute("data-widget-id")) return;
      var id = ts.render(slot, {
        sitekey: turnstileSiteKey(),
        action: action,
        language: lang(),
        "response-field-name": "cf-turnstile-response",
      });
      slot.setAttribute("data-widget-id", id);
    });
  }

  function resetTurnstile(form) {
    var slot = form.querySelector("[data-turnstile-slot]");
    var id = slot && slot.getAttribute("data-widget-id");
    if (id && window.turnstile) window.turnstile.reset(id);
  }

  function referralTag() {
    var params = new URLSearchParams(window.location.search);
    var tag = params.get("ref") || params.get("utm_source");
    if (tag) return tag.slice(0, 50);
    try {
      return document.referrer ? new URL(document.referrer).hostname : "direct";
    } catch (_e) {
      return "direct";
    }
  }

  function field(form, name) {
    var el = form.elements[name];
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    return String(el.value || "").trim();
  }

  function checkedValues(form, name) {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="' + name + '"]:checked'))
      .map(function (el) {
        return el.value;
      });
  }

  function ensureMessageBox(form) {
    var msg = form.querySelector(".form-message") || form.parentNode.querySelector(".form-message");
    if (msg) return msg;
    msg = document.createElement("p");
    msg.className = "form-message";
    msg.setAttribute("aria-live", "polite");
    form.insertBefore(msg, form.querySelector('button[type="submit"]'));
    return msg;
  }

  function showFormMessage(el, type, text, withEmail) {
    if (!el) return;
    el.textContent = text + (withEmail ? " " : "");
    if (withEmail) {
      var link = document.createElement("a");
      link.href = "mailto:" + SUPPORT_EMAIL;
      link.textContent = SUPPORT_EMAIL;
      el.appendChild(link);
      el.appendChild(document.createTextNode("."));
    }
    el.className = "form-message is-visible " + (type || "");
  }

  function setSubmitState(form, busy) {
    var button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.getAttribute("data-default-label")) {
      button.setAttribute("data-default-label", button.textContent || "Submit");
    }
    button.disabled = !!busy;
    if (busy) {
      button.setAttribute("aria-busy", "true");
      button.textContent = t("sending");
    } else {
      button.removeAttribute("aria-busy");
      button.textContent = button.getAttribute("data-default-label") || "Submit";
    }
  }

  function markInvalid(form, fields) {
    form.querySelectorAll(".form-group.is-invalid").forEach(function (g) {
      g.classList.remove("is-invalid");
    });
    (fields || []).forEach(function (name) {
      var group = form.querySelector('[data-field="' + name + '"]');
      if (name === "contact") {
        ["email", "phone_number"].forEach(function (n) {
          var g = form.querySelector('[data-field="' + n + '"]');
          if (g) g.classList.add("is-invalid");
        });
      }
      if (group) group.classList.add("is-invalid");
    });
  }

  function postJson(path, payload) {
    return fetch(resolveApiBase() + path, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.text().then(function (text) {
        var body = {};
        try {
          body = JSON.parse(text);
        } catch (_e) {
          body = {};
        }
        return { status: res.status, ok: res.ok && body.ok === true, body: body };
      });
    });
  }

  function handleFailure(form, msg, result) {
    var err = result && result.body && result.body.error;
    if (err === "validation_failed") {
      markInvalid(form, result.body.fields);
      showFormMessage(msg, "error", t("invalid"));
    } else if (err === "verification_failed") {
      showFormMessage(msg, "error", t("verify"));
    } else if (result && result.status === 429) {
      showFormMessage(msg, "error", t("rate"));
    } else {
      showFormMessage(msg, "error", t("failed"), true);
    }
    resetTurnstile(form);
  }

  function failClosed(form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      showFormMessage(ensureMessageBox(form), "error", t("unavailable"), true);
    });
  }

  function applicationPayload(form) {
    return {
      full_name: field(form, "full_name"),
      email: field(form, "email"),
      phone_number: field(form, "phone_number"),
      phone_has_whatsapp: field(form, "phone_has_whatsapp") === true,
      preferred_contact: field(form, "preferred_contact"),
      province: field(form, "province"),
      age_range: field(form, "age_range"),
      guardian_consent: field(form, "guardian_consent") === true,
      primary_language: field(form, "primary_language"),
      education_level: field(form, "education_level"),
      areas_of_interest: checkedValues(form, "areas_of_interest"),
      internet_access_level: field(form, "internet_access_level"),
      device_access: field(form, "device_access"),
      consent_privacy: field(form, "consent_privacy") === true,
      consent_version: field(form, "consent_version"),
      form_language: field(form, "form_language") || lang(),
      referral_source: referralTag(),
      website: field(form, "website"),
      "cf-turnstile-response": field(form, "cf-turnstile-response"),
    };
  }

  function clientChecks(form, payload) {
    var bad = [];
    if (!form.checkValidity()) {
      form.reportValidity();
      return ["native"];
    }
    if (!payload.email && !payload.phone_number) bad.push("contact");
    if (!payload.areas_of_interest.length) bad.push("areas_of_interest");
    if (payload.age_range === "16-17" && !payload.guardian_consent) bad.push("guardian_consent");
    return bad;
  }

  function initWaitlistForm(form) {
    if (!form) return;
    form.removeAttribute("action");
    var guardian = form.querySelector('[data-field="guardian_consent"]');
    var age = form.elements.age_range;
    if (age && guardian) {
      age.addEventListener("change", function () {
        var minor = age.value === "16-17";
        guardian.hidden = !minor;
        var box = guardian.querySelector("input");
        if (box) box.required = minor;
      });
    }
    if (!intakeReady()) return failClosed(form);
    mountTurnstile(form, "waitlist");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (form.getAttribute("data-submitting") === "1") return;
      var msg = ensureMessageBox(form);
      var payload = applicationPayload(form);
      var bad = clientChecks(form, payload);
      if (bad.length) {
        if (bad[0] === "native") return;
        markInvalid(form, bad);
        showFormMessage(msg, "error", t(bad[0] === "areas_of_interest" ? "areas" : bad[0]));
        return;
      }
      markInvalid(form, []);
      form.setAttribute("data-submitting", "1");
      setSubmitState(form, true);
      showFormMessage(msg, "success", t("sending"));
      postJson("/api/waitlist", payload)
        .then(function (result) {
          if (result.ok) {
            window.location.href = thankYouPath();
            return;
          }
          handleFailure(form, msg, result);
        })
        .catch(function () {
          handleFailure(form, msg, null);
        })
        .then(function () {
          form.removeAttribute("data-submitting");
          setSubmitState(form, false);
        });
    });
  }

  function initPrivacyForm(form) {
    if (!form) return;
    if (!intakeReady()) return failClosed(form);
    mountTurnstile(form, "privacy");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var msg = ensureMessageBox(form);
      var payload = {
        request_type: field(form, "request_type"),
        email: field(form, "email"),
        phone_number: field(form, "phone_number"),
        form_language: field(form, "form_language") || lang(),
        website: field(form, "website"),
        "cf-turnstile-response": field(form, "cf-turnstile-response"),
      };
      if (!payload.email && !payload.phone_number) {
        markInvalid(form, ["contact"]);
        showFormMessage(msg, "error", t("contact"));
        return;
      }
      setSubmitState(form, true);
      postJson("/api/privacy-request", payload)
        .then(function (result) {
          if (result.ok) {
            form.reset();
            resetTurnstile(form);
            showFormMessage(
              msg,
              "success",
              t("privacyDone").replace("{ref}", result.body.reference)
            );
            return;
          }
          handleFailure(form, msg, result);
        })
        .catch(function () {
          handleFailure(form, msg, null);
        })
        .then(function () {
          setSubmitState(form, false);
        });
    });
  }

  function initReveal() {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var targets = document.querySelectorAll(
      "main .section, main .tile, .page-hero, .waitlist-wrap"
    );
    if (!targets.length) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    targets.forEach(function (el) {
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  function initSupportWidget() {
    if (document.getElementById("biug-support-launcher")) return;

    var style = document.createElement("style");
    style.textContent =
      ".biug-support-launcher{position:fixed;right:20px;bottom:20px;z-index:9998;border:0;border-radius:999px;padding:12px 18px;background:#111;color:#fff;font:600 14px 'DM Sans',sans-serif;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.24)}" +
      ".biug-support-panel{position:fixed;right:20px;bottom:76px;z-index:9999;width:min(360px,calc(100vw - 32px));background:#fff;color:#151515;border:1px solid #ddd;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.22);padding:18px;display:none;font-family:'DM Sans',sans-serif}" +
      ".biug-support-panel.is-open{display:block}.biug-support-panel h3{margin:0 0 6px;font-size:18px}.biug-support-panel p{margin:0 0 14px;font-size:13px;line-height:1.45;color:#555}" +
      ".biug-support-panel label{display:block;font-size:12px;font-weight:700;margin:10px 0 4px}.biug-support-panel input,.biug-support-panel textarea{box-sizing:border-box;width:100%;border:1px solid #ccc;border-radius:9px;padding:10px;font:14px 'DM Sans',sans-serif}.biug-support-panel textarea{min-height:92px;resize:vertical}" +
      ".biug-support-actions{display:flex;gap:8px;margin-top:12px}.biug-support-actions button{border:0;border-radius:9px;padding:10px 13px;cursor:pointer;font-weight:700}.biug-support-send{background:#111;color:#fff}.biug-support-close{background:#eee;color:#111}.biug-support-status{font-size:12px!important;margin-top:10px!important}";
    document.head.appendChild(style);

    var panel = document.createElement("aside");
    panel.className = "biug-support-panel";
    panel.id = "biug-support-panel";
    panel.setAttribute("aria-label", "BIU.G Academy support");
    panel.innerHTML =
      "<h3>BIU.G Academy Support</h3>" +
      "<p>Envie uma mensagem à nossa equipa em " +
      SUPPORT_EMAIL +
      ".</p>" +
      '<form id="biug-support-form">' +
      '<label for="biug-support-name">Nome</label><input id="biug-support-name" name="name" required autocomplete="name">' +
      '<label for="biug-support-email">Email</label><input id="biug-support-email" name="email" type="email" required autocomplete="email">' +
      '<label for="biug-support-message">Mensagem</label><textarea id="biug-support-message" name="message" required maxlength="2000"></textarea>' +
      '<label class="biug-support-consent"><input type="checkbox" name="consent_privacy" required> <span>' +
      t("supportConsent") +
      ' <a href="' +
      privacyPath() +
      '">' +
      t("privacyLink") +
      "</a></span></label>" +
      '<div class="biug-turnstile" data-turnstile-slot></div>' +
      '<div class="biug-support-actions"><button class="biug-support-send" type="submit">Enviar</button><button class="biug-support-close" type="button">Fechar</button></div>' +
      '<p class="biug-support-status" id="biug-support-status" aria-live="polite"></p>' +
      "</form>";
    document.body.appendChild(panel);

    var launcher = document.createElement("button");
    launcher.id = "biug-support-launcher";
    launcher.className = "biug-support-launcher";
    launcher.type = "button";
    launcher.textContent = "Support";
    launcher.setAttribute("aria-controls", "biug-support-panel");
    launcher.setAttribute("aria-expanded", "false");
    document.body.appendChild(launcher);

    var close = panel.querySelector(".biug-support-close");
    var form = panel.querySelector("#biug-support-form");
    var status = panel.querySelector("#biug-support-status");
    var send = panel.querySelector(".biug-support-send");

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      launcher.setAttribute("aria-expanded", open ? "true" : "false");
    }

    launcher.addEventListener("click", function () {
      var opening = !panel.classList.contains("is-open");
      setOpen(opening);
      // Load Turnstile only when the visitor actually opens the support panel.
      if (opening) mountTurnstile(form, "support");
    });
    close.addEventListener("click", function () {
      setOpen(false);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!intakeReady()) {
        status.textContent = t("unavailable") + " " + SUPPORT_EMAIL + ".";
        return;
      }
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      send.disabled = true;
      status.textContent = t("sending");
      postJson("/api/support", {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim(),
        consent_privacy: form.elements.consent_privacy.checked,
        form_language: lang(),
        page_url: window.location.origin + window.location.pathname,
        "cf-turnstile-response": field(form, "cf-turnstile-response"),
      })
        .then(function (result) {
          if (!result.ok) throw result;
          form.reset();
          resetTurnstile(form);
          status.textContent = t("supportDone");
        })
        .catch(function (result) {
          resetTurnstile(form);
          var err = result && result.body && result.body.error;
          status.textContent =
            err === "verification_failed"
              ? t("verify")
              : result && result.status === 429
                ? t("rate")
                : t("failed") + " " + SUPPORT_EMAIL + ".";
        })
        .then(function () {
          send.disabled = false;
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initLanguageSelector();
    initReveal();
    document.querySelectorAll("form[data-intake-form='waitlist']").forEach(initWaitlistForm);
    document.querySelectorAll("form[data-intake-form='privacy']").forEach(initPrivacyForm);
    initSupportWidget();
  });
})();
