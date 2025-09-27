/*! consent-bind.js — Hum Studios (no auto-open)
 *  Purpose: Bind explicit UI controls to the Consent API (theme-only).
 *  Behaviour:
 *    - NO automatic banner opening on any page.
 *    - Binds clicks on "change settings" controls to open the banner.
 *    - Resilient if consent.js loads late (waits for consent:ready; emits consent:show hint).
 *    - Tiny public API: window.ConsentBind.open()
 */
(function () {
  'use strict';

  function openConsent() {
    if (window.Consent && typeof window.Consent.show === 'function') {
      try { window.Consent.show(); } catch (e) {}
      return;
    }
    // If consent.js isn't ready yet, wait once for its ready signal
    document.addEventListener('consent:ready', function onReady() {
      document.removeEventListener('consent:ready', onReady);
      try { window.Consent && window.Consent.show && window.Consent.show(); } catch (e) {}
    }, { once: true });

    // Fallback hook some implementations listen for
    try { document.dispatchEvent(new Event('consent:show')); } catch (e) {}
  }

  function bindTriggers(ctx) {
    var root = ctx || document;
    var selector = [
      '#manage-cookies-btn',
      '#change-settings',
      '#cookie-settings',
      '[data-action="open-consent"]',
      'a[href="#manage-cookies"]'
    ].join(',');

    root.querySelectorAll(selector).forEach(function (el) {
      // Avoid double-binding
      if (el.__consentBindAttached) return;
      el.__consentBindAttached = true;

      el.addEventListener('click', function (ev) {
        // Prevent navigation if it's an anchor; safe for buttons too
        if (ev) ev.preventDefault();
        openConsent();
      }, { passive: false });
    });
  }

  function observeNewTriggers() {
    // Capture dynamically added buttons/links
    var mo = new MutationObserver(function (mutations) {
      for (var i=0; i<mutations.length; i++) {
        var m = mutations[i];
        if (!m.addedNodes || !m.addedNodes.length) continue;
        for (var j=0; j<m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node && node.nodeType === 1) { // Element
            bindTriggers(node);
          }
        }
      }
    });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  }

  function init() {
    bindTriggers(document);
    observeNewTriggers();
    // Intentionally no auto-open behaviour (per design).
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Tiny public API for tests or manual triggers
  window.ConsentBind = {
    open: openConsent,
    bind: function () { bindTriggers(document); }
  };
})();
