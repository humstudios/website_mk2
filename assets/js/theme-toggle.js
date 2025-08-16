// theme-toggle.js — resilient init for header include + unified storage (2025-08-15)
(function () {
  var STORAGE_KEYS = ["theme", "display-mode"]; // read both, write both
  var btnId = "theme-toggle";
  var root = document.documentElement;

  function getSavedTheme() {
    for (var i = 0; i < STORAGE_KEYS.length; i++) {
      try {
        var v = localStorage.getItem(STORAGE_KEYS[i]);
        if (v === "light" || v === "dark") return v;
        if (v === "dark+dim") return "dark";
      } catch (e) {}
    }
    // fall back to OS
    try {
      return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function setSavedTheme(themeName) {
    for (var i = 0; i < STORAGE_KEYS.length; i++) {
      try { localStorage.setItem(STORAGE_KEYS[i], themeName); } catch (e) {}
    }
  }

  function ensureMarkup(btn) {
    if (!btn.querySelector(".theme-toggle__slider")) {
      btn.innerHTML = '<span class="theme-toggle__slider"><span class="theme-toggle__thumb"><svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5V2M12 22v-2.5M4.5 12H2M22 12h-2.5M5.6 5.6L4 4M20 20l-1.6-1.6M5.6 18.4L4 20M20 4l-1.6 1.6M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/></svg><svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg></span></span>';
    }
  }

  function apply(themeName, btn) {
    root.setAttribute("data-theme", themeName);
    // remove any legacy dim classes
    root.classList.remove("theme-dim", "theme-dim-off");
    setSavedTheme(themeName);
    if (btn) {
      btn.setAttribute("aria-pressed", themeName === "dark" ? "true" : "false");
      btn.setAttribute("aria-label", themeName === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.title = themeName === "dark" ? "Dark mode" : "Light mode";
    }
  }

  function wire(btn) {
    if (!btn) return;
    ensureMarkup(btn);
    var current = root.getAttribute("data-theme") || getSavedTheme();
    apply(current, btn);
    btn.addEventListener("click", function () {
      current = (current === "dark") ? "light" : "dark";
      apply(current, btn);
    });
  }

  function tryInit() {
    var btn = document.getElementById(btnId);
    if (btn) { wire(btn); return true; }
    return false;
  }

  // Also run when includes.js finishes injecting partials
  document.addEventListener("partials:loaded", tryInit, { once: true });

// Run after parse
  if (!tryInit()) {
    // If header injected later, observe for the button
    var obs = new MutationObserver(function (list, observer) {
      if (tryInit()) { observer.disconnect(); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // Safety timeout: stop observing after 10s
    setTimeout(function(){ try { obs.disconnect(); } catch(e){} }, 10000);
    // Also run on DOMContentLoaded just in case
    document.addEventListener("DOMContentLoaded", tryInit, { once: true });
  }

  // Cross-tab/theme sync (optional)
  window.addEventListener("storage", function (e) {
    if (STORAGE_KEYS.indexOf(e.key) !== -1) {
      var v = getSavedTheme();
      apply(v, document.getElementById(btnId));
    }
  });
})();