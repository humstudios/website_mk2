// turnstile-init.SAFE.js
// Explicit render only. No live theme sync or heavy observers.

(function () {
  function renderAll() {
    if (!window.turnstile) return;
    document.querySelectorAll(".cf-turnstile").forEach(function (el) {
      if (el.__tsReady) return;
      var headKey = (document.querySelector('meta[name="turnstile-sitekey"]')||{}).content || null;
      var key = el.getAttribute("data-sitekey") || headKey;
      if (!key) return;
      window.turnstile.render(el, {
        sitekey: key,
        theme: el.getAttribute("data-theme") || "auto",
        action: el.getAttribute("data-action") || "contact",
        callback: function () { try { if (typeof window.enableSubmit === "function") window.enableSubmit(); } catch (e) {} }
      });
      el.__tsReady = true;
    });
  }

  // Render once when API loads
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (window.turnstile) { clearInterval(iv); renderAll(); }
    else if (tries > 50) { clearInterval(iv); }
  }, 200);
})();