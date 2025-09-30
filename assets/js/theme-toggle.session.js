/* assets/js/theme-toggle.session.js — robust (direct + delegated, no double toggles) */
(function () {
 'use strict';
   "use strict";

  var THEME_KEY = "theme.session";
  var BTN_SEL = "#theme-toggle";

  function getTheme() {
    // Prefer sessionStorage (user's current per-tab choice), then <html data-theme>, else light
    try {
      var s = sessionStorage.getItem(THEME_KEY);
      if (s === "dark" || s === "light") return s;
    } catch (e) {}
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return "light";
  }

  function setTheme(t) {
    var v = (t === "dark") ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", v);
    try { sessionStorage.setItem(THEME_KEY, v); } catch (e) {}
    syncButton(v);
    try {
      document.dispatchEvent(new CustomEvent("hum:themechange", { detail: { theme: v }, bubbles: true }));
    } catch (e) {}
  }

  function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  }

  function syncButton(theme) {
    var btn = document.querySelector(BTN_SEL);
    if (!btn) return;
    var isDark = (theme === "dark");
    var nextLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
    btn.type = "button";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.setAttribute("aria-label", nextLabel);
    btn.title = nextLabel;
    var vh = btn.querySelector(".visually-hidden, .vh");
    if (vh) {
      vh.textContent = nextLabel;
    } else {
      // Auto-inject hidden label if missing (A11Y)
      try {
        var span = document.createElement('span');
        span.className = 'visually-hidden';
        span.textContent = nextLabel;
        btn.appendChild(span);
      } catch(e) {}
    }
    if (!btn.querySelector("svg")) btn.textContent = isDark ? "Dark" : "Light";
  }

  // Mark an event as handled so delegated and direct handlers don't both toggle
  function markHandled(ev) { try { ev.__humThemeHandled = true; } catch(e) {} }
  function alreadyHandled(ev) { return !!(ev && ev.__humThemeHandled); }

  function bindDirect() {
    var btn = document.querySelector(BTN_SEL);
    if (!btn || btn.__humBound) return;
    btn.__humBound = true;
    btn.addEventListener("click", function (e) {
      if (alreadyHandled(e)) return;
      markHandled(e);
      toggleTheme();
    });
    btn.addEventListener("keydown", function (e) {
      if (alreadyHandled(e)) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        markHandled(e);
        toggleTheme();
      }
    });
  }

  function bindDelegated() {
    if (document.__humDelegatedBound) return;
    document.__humDelegatedBound = true;

    document.addEventListener("click", function (ev) {
      if (alreadyHandled(ev)) return;
      // Find a current or future #theme-toggle
      var t = ev.target;
      var btn = t && (t.matches && t.matches(BTN_SEL) ? t : (t && t.closest && t.closest(BTN_SEL)));
      if (!btn) return;
      if (ev.button !== 0) return; // left click only
      markHandled(ev);
      toggleTheme();
    }, true);

    document.addEventListener("keydown", function (e) {
      if (alreadyHandled(e)) return;
      var t = e.target;
      var btn = t && (t.matches && t.matches(BTN_SEL) ? t : (t && t.closest && t.closest(BTN_SEL)));
      if (!btn) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        markHandled(e);
        toggleTheme();
      }
    }, true);
  }

  function init() {
    syncButton(getTheme());
    bindDirect();
    bindDelegated();
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init, { once: true }); }
  else { init(); }

  // Optional test hook for console
  try { window.humToggleTheme = toggleTheme; } catch (e) {}
})();
