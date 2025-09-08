/* Theme toggle (idempotent + GH Pages + async header)
   - Default to light; persist manual choice (localStorage)
   - Delegated click handler (works even if header is injected later)
   - Syncs <meta name="color-scheme"> and button UI
   - Safe if included multiple times (guards against double-binding)
*/
(function () {
  'use strict';
  if (window.__themeToggleInit) return;
  window.__themeToggleInit = true;

  var KEY = 'theme';
  var root = document.documentElement;
  var meta = document.querySelector('meta[name="color-scheme"]');

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    if (meta) meta.setAttribute('content', theme === 'dark' ? 'dark light' : 'light dark');
    syncButtons(theme);
  }

  function getSaved() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === 'dark' || v === 'light') return v;
    } catch (e) {}
    return 'light'; // default on first visit
  }

  function syncButtons(theme) {
    var pressed = theme === 'dark';
    var title = pressed ? 'Dark mode' : 'Light mode';
    var nodes = document.querySelectorAll('[data-theme-toggle], #theme-toggle');
    nodes.forEach(function (btn) {
      try {
        if (btn.tagName === 'INPUT' && btn.type && btn.type.toLowerCase() === 'checkbox') {
          btn.checked = pressed;
        }
        btn.setAttribute('aria-pressed', String(pressed));
        btn.setAttribute('title', title);
        btn.dataset.themeState = theme;
        btn.classList.toggle('is-dark', pressed);
        btn.classList.toggle('is-light', !pressed);
      } catch (e) {}
    });
  }

  // Apply saved theme immediately and sync controls
  apply(getSaved());

  // Delegated click handler (survives async includes/header injection)
  function onClick(e) {
    var btn = e.target && e.target.closest && (e.target.closest('[data-theme-toggle]') || e.target.closest('#theme-toggle'));
    if (!btn) return;
    var next = (root.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  }
  document.addEventListener('click', onClick, true);

  // Keep multiple tabs in sync
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === KEY && (ev.newValue === 'light' || ev.newValue === 'dark')) {
      apply(ev.newValue);
    }
  });

  // If the header/toggle is injected later, keep the UI in sync
  var mo = new MutationObserver(function () {
    if (document.querySelector('[data-theme-toggle], #theme-toggle')) {
      syncButtons(root.getAttribute('data-theme') || 'light');
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true });
})();