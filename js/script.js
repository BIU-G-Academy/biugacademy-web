/**
 * BIU.G Academy — navigation, first-cohort intake and support.
 *
 * Data paths:
 * 1. Preferred (when an API base is configured via data-api-base,
 *    <meta name="biug-api-base"> or window.BIUG_API_BASE):
 *    browser -> BIU.G Academy API -> PostgreSQL + transactional email outbox.
 * 2. Interim fallback (no API configured, e.g. static GitHub Pages hosting):
 *    the form's own HTML action (FormSubmit relay to support@biugacademy.org).
 *    Before this fallback existed, submissions on static hosting were sent to
 *    "/api/waitlist" on GitHub Pages, which answers 404/405, so every
 *    application failed. Remove the fallback once the API is deployed.
 */

(function () {
  "use strict";

  var DEFAULT_API_BASE = "";
  var SUPPORT_EMAIL = "support@biugacademy.org";
  // Interim relay used only when no Academy API is configured.
  var RELAY_FORM_ACTION = "https://formsubmit.co/" + SUPPORT_EMAIL;
  var RELAY_AJAX_ENDPOINT = "https://formsubmit.co/ajax/" + SUPPORT_EMAIL;

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

  function resolveApiBase(form) {
    var baseTag = document.querySelector('meta[name="biug-api-base"]');
    var fromWindow = window.BIUG_API_BASE || "";
    var base =
      (form && form.getAttribute("data-api-base")) ||
      (baseTag ? baseTag.getAttribute("content") : "") ||
      fromWindow ||
      DEFAULT_API_BASE;
    return String(base || "").replace(/\/+$/, "");
  }

  function apiEndpoint(form, path) {
    return resolveApiBase(form) + path;
  }

  /**
   * True only when an explicit API origin is configured, or the page opts in
   * with <html data-biug-api-same-origin> (host that also serves /api/*).
   * Static hosts such as GitHub Pages cannot accept POST /api/*.
   */
  function apiIsConfigured(form) {
    if (resolveApiBase(form)) return true;
    return document.documentElement.hasAttribute("data-biug-api-same-origin");
  }

  function thankYouPathForLanguage() {
    var lang = detectActiveLanguage(window.location.pathname || "/");
    if (lang === "en") return "/en/thank-you/";
    if (lang === "fr") return "/fr/candidature-recue/";
    return "/pt/candidatura-recebida/";
  }

  function ensureHiddenInput(form, name, value) {
    var input = form.querySelector('input[name="' + name + '"]');
    if (input) return input;
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
    return input;
  }

  /**
   * Prepare a waitlist form for a native POST to the relay. Keeps the form's
   * existing action when it already points at the relay; otherwise restores it.
   */
  function prepareRelaySubmission(form) {
    var action = form.getAttribute("action") || "";
    if (action.indexOf("https://formsubmit.co/") !== 0) {
      form.setAttribute("action", RELAY_FORM_ACTION);
    }
    form.setAttribute("method", "POST");
    ensureHiddenInput(form, "_subject", "BIU.G Academy - New First Cohort Application");
    ensureHiddenInput(form, "_template", "table");
    ensureHiddenInput(form, "_captcha", "false");
    ensureHiddenInput(form, "_next", window.location.origin + thankYouPathForLanguage());
  }

  function guessReferralSource() {
    var params = new URLSearchParams(window.location.search);
    return params.get("ref") || params.get("utm_source") || document.referrer || "direct";
  }

  function populateHiddenMetadata(form) {
    var browserLanguageInput = form.querySelector('input[name="browser_language"]');
    var timezoneInput = form.querySelector('input[name="timezone"]');
    var referralInput = form.querySelector('input[name="referral_source"]');
    var submittedAtInput = form.querySelector('input[name="submission_timestamp"]');
    if (browserLanguageInput) browserLanguageInput.value = navigator.language || "";
    if (timezoneInput && window.Intl && Intl.DateTimeFormat) {
      timezoneInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    }
    if (referralInput) referralInput.value = guessReferralSource();
    if (submittedAtInput) submittedAtInput.value = new Date().toISOString();
  }

  function formDataToObject(form) {
    var fd = new FormData(form);
    var payload = {};
    fd.forEach(function (value, key) {
      if (key.charAt(0) === "_") return;
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        if (!Array.isArray(payload[key])) payload[key] = [payload[key]];
        payload[key].push(value);
      } else {
        payload[key] = value;
      }
    });
    if (payload.consent_checkbox !== undefined) {
      payload.consent_checkbox =
        ["yes", "true", "on", true].indexOf(payload.consent_checkbox) !== -1;
    }
    payload.honeypot = payload.website || payload.honeypot || "";
    delete payload.website;
    return payload;
  }

  function ensureMessageBox(form) {
    var msg = form.parentNode.querySelector(".form-message");
    if (msg) return msg;
    msg = document.createElement("div");
    msg.className = "form-message";
    msg.setAttribute("aria-live", "polite");
    form.parentNode.insertBefore(msg, form);
    return msg;
  }

  function showFormMessage(el, type, text) {
    if (!el) return;
    el.textContent = text;
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
      button.textContent = "A enviar candidatura...";
    } else {
      button.removeAttribute("aria-busy");
      button.textContent = button.getAttribute("data-default-label") || "Submit";
    }
  }

  function parseJsonResponse(res) {
    return res.text().then(function (text) {
      var body = {};
      try {
        body = JSON.parse(text);
      } catch (_ignore) {
        body = {};
      }
      return { res: res, body: body };
    });
  }

  function initWaitlistForm(form) {
    if (!form) return;
    populateHiddenMetadata(form);

    if (!apiIsConfigured(form)) {
      // No Academy API on this host: let the browser submit natively to the
      // relay declared in the HTML action. Do not intercept the submit.
      prepareRelaySubmission(form);
      form.addEventListener("submit", function () {
        populateHiddenMetadata(form);
        setSubmitState(form, true);
      });
      return;
    }

    form.removeAttribute("action");
    form.setAttribute("method", "POST");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (form.getAttribute("data-submitting") === "1") return;

      form.setAttribute("data-submitting", "1");
      populateHiddenMetadata(form);
      var msg = ensureMessageBox(form);
      var payload = formDataToObject(form);
      setSubmitState(form, true);
      showFormMessage(msg, "success", "A enviar candidatura...");

      fetch(apiEndpoint(form, "/api/waitlist"), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(parseJsonResponse)
        .then(function (result) {
          if (result.res.ok && result.body && result.body.ok) {
            var next = form.querySelector('input[name="_next"]');
            window.location.href = next && next.value ? next.value : "/thank-you/";
            return;
          }
          var detail = result.body && (result.body.error || result.body.message);
          throw new Error(detail || "Submission failed");
        })
        .catch(function (error) {
          form.removeAttribute("data-submitting");
          setSubmitState(form, false);
          console.error("BIU.G Academy application submission failed", error);
          showFormMessage(
            msg,
            "error",
            "Não foi possível enviar a candidatura. Verifique a ligação e tente novamente."
          );
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
      '<label for="biug-support-message">Mensagem</label><textarea id="biug-support-message" name="message" required></textarea>' +
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
      setOpen(!panel.classList.contains("is-open"));
    });
    close.addEventListener("click", function () {
      setOpen(false);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      send.disabled = true;
      status.textContent = "A enviar...";
      var supportPayload = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim(),
        page_url: window.location.href,
      };
      var useApi = apiIsConfigured(null);
      if (!useApi) {
        supportPayload._subject = "BIU.G Academy - Support request";
        supportPayload._template = "table";
        supportPayload._captcha = "false";
      }
      fetch(useApi ? apiEndpoint(null, "/api/support") : RELAY_AJAX_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(supportPayload),
      })
        .then(parseJsonResponse)
        .then(function (result) {
          // Academy API answers {ok:true}; the relay answers {success:"true"}.
          var accepted = useApi
            ? result.body && result.body.ok
            : result.body && String(result.body.success) === "true";
          if (!result.res.ok || !accepted) throw new Error("Support submission failed");
          form.reset();
          status.textContent = "Mensagem recebida. A equipa de suporte foi notificada.";
        })
        .catch(function (error) {
          console.error("BIU.G Academy support submission failed", error);
          status.textContent = "Não foi possível enviar. Tente novamente.";
        })
        .finally(function () {
          send.disabled = false;
        });
    });
  }

  /**
   * Optional analytics. Disabled unless a token is configured. Set ONE of:
   *   <meta name="biug-cf-analytics-token" content="YOUR_CF_WEB_ANALYTICS_TOKEN">
   *   window.BIUG_CF_ANALYTICS_TOKEN = "YOUR_CF_WEB_ANALYTICS_TOKEN";
   * (Cloudflare Web Analytics, cookieless.) For GA4 instead, set
   *   <meta name="biug-ga4-id" content="G-XXXXXXXXXX"> - requires a consent decision.
   * No token is shipped in the repository.
   */
  function initAnalytics() {
    var cfMeta = document.querySelector('meta[name="biug-cf-analytics-token"]');
    var cfToken =
      (cfMeta && cfMeta.getAttribute("content")) || window.BIUG_CF_ANALYTICS_TOKEN || "";
    if (cfToken) {
      var cf = document.createElement("script");
      cf.defer = true;
      cf.src = "https://static.cloudflareinsights.com/beacon.min.js";
      cf.setAttribute("data-cf-beacon", JSON.stringify({ token: cfToken }));
      document.head.appendChild(cf);
    }
    var gaMeta = document.querySelector('meta[name="biug-ga4-id"]');
    var gaId = (gaMeta && gaMeta.getAttribute("content")) || "";
    if (gaId) {
      var ga = document.createElement("script");
      ga.async = true;
      ga.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
      document.head.appendChild(ga);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", gaId);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAnalytics();
    initNav();
    initLanguageSelector();
    initReveal();
    document.querySelectorAll("form[data-intake-form='waitlist']").forEach(initWaitlistForm);
    initSupportWidget();
  });
})();
