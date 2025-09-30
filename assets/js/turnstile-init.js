// turnstile-init.UNIFIED.js
// Works with auto-render *and* explicit render (?onload=onTurnstileLoad).
// - Skips rendering if widget already present (auto-rendered or previously rendered).
// - Calls window.enableSubmit() after successful solve if defined.

(function () {
  'use strict';
  function isRendered(el) {
    // Already rendered if there's an iframe (Turnstile injects one)
    if (el.querySelector('iframe[src*="/turnstile/"]')) return true;
    // Or if the nearest form already has the hidden response input
    var form = el.closest('form');
    if (form && form.querySelector('input[name="cf-turnstile-response"]')) return true;
    return false;
  }

  function renderAll() {
    if (!window.turnstile || typeof window.turnstile.render !== 'function') return;
    document.querySelectorAll('.cf-turnstile').forEach(function (el) {
      'use strict';
  if (isRendered(el)) return;
      var headKey = (document.querySelector('meta[name="turnstile-sitekey"]') || {}).content || null;
      var key = el.getAttribute('data-sitekey') || headKey;
      if (!key) return;
      try {
        window.turnstile.render(el, {
          sitekey: key,
          theme: el.getAttribute('data-theme') || 'auto',
          action: el.getAttribute('data-action') || 'contact',
          callback: function () {
            try { if (typeof window.enableSubmit === 'function') window.enableSubmit(); } catch (e) {}
          }
        });
      } catch (e) {
        // If auto-render already ran, render() may throw; that's fine.
        // We just skip in that case.
        console.debug('[turnstile-init] render skipped:', e && e.message);
      }
    });
  }

  // Expose for explicit onload mode
  function onTurnstileLoad() { renderAll(); }
  window.onTurnstileLoad = onTurnstileLoad;

  // Defensive: if the API is already present (auto-render mode), try to render any leftover elements.
  if (window.turnstile) renderAll();

  // Also observe DOM in case elements are added later (lightweight)
  var obs;
  try {
    obs = new MutationObserver(function (mutations) {
      'use strict';
  for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes && m.addedNodes.length) {
          // If any .cf-turnstile gets added, try to render it
          document.querySelectorAll('.cf-turnstile').forEach(function (el) {
            'use strict';
  if (!isRendered(el)) renderAll();
          });
        }
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true });
  } catch (e) {}
})();