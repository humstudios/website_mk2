// theme-toggle.session.js (patched 2025-09-12)
// Two-state (Light/Dark) toggle. Preserves button inner markup (no text replacement).
// Updates: aria-pressed, title, and <html data-theme>. Uses sessionStorage('theme.session').

(function () {
  if (window.__themeToggleInit) return;
  window.__themeToggleInit = true;

  var KEY = "theme.session";
  var root = document.documentElement;

  function getStored() {
    try {
      var v = sessionStorage.getItem(KEY);
      if (v === "light" || v === "dark") return v;
    } catch (e) {}
    return null;
  }

  function current() {
    var stored = getStored();
    if (stored) return stored;
    var attr = root.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
    return "light";
  }

  function label(btn, t) {
    // Don't touch inner markup; just update a11y + tooltip.
    btn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
    btn.setAttribute("title", t === "dark" ? "Dark mode" : "Light mode");
  }

  function apply(t) {
    var theme = (t === "dark") ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    try { sessionStorage.setItem(KEY, theme); } catch (e) {}
    var btn = document.getElementById("theme-toggle");
    if (btn) label(btn, theme);
  }

  function init() {
    apply(current());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  document.addEventListener("click", function (e) {
    var btn = e.target && (e.target.id === "theme-toggle" ? e.target :
                 (e.target.closest && e.target.closest("#theme-toggle")));
    if (!btn) return;
    e.preventDefault();
    var next = (current() === "light") ? "dark" : "light";
    apply(next);
  }, true);
})();
