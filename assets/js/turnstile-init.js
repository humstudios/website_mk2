// turnstile-init.SAFE.js (onload-based, explicit render)
// Explicit render only. No live theme sync or heavy observers.
// - Renders when the Turnstile API calls `window.onTurnstileLoad`
// - Also renders immediately if the API is already present (defensive)
// - Keeps meta[name="turnstile-sitekey"] fallback
// - Calls window.enableSubmit() if defined after successful solve

(function () {
  function renderAll() {
    if (!window.turnstile) return;
    document.querySelectorAll(".cf-turnstile").forEach(function (el) {
      if (el.__tsReady) return;
      var headKey = (document.querySelector('meta[name="turnstile-sitekey"]') || {}).content || null;
      var key = el.getAttribute("data-sitekey") || headKey;
      if (!key) return;
      window.turnstile.render(el, {
        sitekey: key,
        theme: el.getAttribute("data-theme") || "auto",
        action: el.getAttribute("data-action") || "contact",
        callback: function () {
          try { if (typeof window.enableSubmit === "function") window.enableSubmit(); } catch (e) {}
        }
      });
      el.__tsReady = true;
    });
  }

  // Expose the onload callback for the API script param: ?onload=onTurnstileLoad
  function onTurnstileLoad() { renderAll(); }
  window.onTurnstileLoad = onTurnstileLoad;

  // Defensive: if the API was already present before this script ran, render now.
  if (window.turnstile) renderAll();
})();