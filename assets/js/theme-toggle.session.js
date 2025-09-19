// theme-toggle.session.js — robust 2-state toggle (light/dark)
// - Syncs with current effective theme (attr -> stored -> system)
// - Guarantees first click toggles immediately (no "two click" issue)
// - Persists to sessionStorage('theme.session')
// - Updates aria-pressed/title on #theme-toggle
(function () {
  if (window.__themeToggleInit) return;
  window.__themeToggleInit = true;

  var KEY = "theme.session";
  var root = document.documentElement;

  function systemTheme() {
    try {
      return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }
  function getStored() {
    try {
      var v = sessionStorage.getItem(KEY);
      return (v === "light" || v === "dark") ? v : null;
    } catch (e) {
      return null;
    }
  }
  function setStored(v) {
    try { sessionStorage.setItem(KEY, v); } catch (e) {}
  }
  function current() {
    // Prefer the live attribute so we reflect the actual page state
    return root.getAttribute("data-theme") || getStored() || systemTheme();
  }
  function updateButton(theme) {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    try { btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode"; } catch(e) {}
  }
  function apply(theme) {
    var t = (theme === "light" || theme === "dark") ? theme : systemTheme();
    if (root.getAttribute("data-theme") !== t) {
      root.setAttribute("data-theme", t);
    }
    setStored(t);
    updateButton(t);
    // Optional custom event if other scripts care
    try { 
      var ev = new CustomEvent("hum:themechange", { detail: { theme: t } });
      window.dispatchEvent(ev);
    } catch (e) {}
  }
  function init() {
    // Ensure attribute reflects effective theme and is persisted once
    apply(current());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // Delegate clicks so it works when the icon/text inside is clicked
  document.addEventListener("click", function (e) {
    var btn = e.target && (e.target.id === "theme-toggle" ? e.target :
                (e.target.closest && e.target.closest("#theme-toggle")));
    if (!btn) return;
    e.preventDefault();
    var next = current() === "light" ? "dark" : "light";
    apply(next);
  }, true);
})();