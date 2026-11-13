/**
 * BIU.G Academy — navigation and language selector.
 *
 * Option A (applications not open): this script does NOT bind, collect, store or
 * send any form data. The first-cohort intake handler and the support widget
 * (previously sending data to the Academy API) have been removed.
 */

(function () {
  "use strict";

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

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initLanguageSelector();
    initReveal();
  });
})();
