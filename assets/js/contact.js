// /assets/js/contact.js
// AJAX submit (no reload). Works with Cloudflare Turnstile.
// - Enables the button when Turnstile completes
// - Submits via fetch and shows inline success/error
// - Resets Turnstile after a successful send
// - Keeps success message on refresh (doesn't get cleared by Turnstile's hidden input)

window.__contactAjaxReady = true;

(function () {
  'use strict';
  var SUCCESS_TEXT = 'Thanks — your message was sent!';
  var SENDING_TEXT = 'Sending…';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function setStatus(text, isSuccess) {
    var s = $('[data-status]');
    if (!s) return;
    if (isSuccess) s.setAttribute('data-success', '1'); else s.removeAttribute('data-success');
    s.textContent = text || '';
  }

  // Turnstile: called on successful challenge
  window.enableSubmit = function enableSubmit() {
    var btn = $('[type="submit"], #send, #submit-button');
    if (btn) btn.removeAttribute('disabled');
    var s = $('[data-status]');
    if (s && !s.hasAttribute('data-success')) s.textContent = '';
  };

  // Turnstile: called on client-side error (e.g., privacy extension blocking)
  window.tsError = function tsError(code) {
    setStatus(
      "We couldn’t verify you (" + code + "). If you use privacy extensions, allow challenges.cloudflare.com and try again.",
      false
    );
    try { window.turnstile && window.turnstile.reset && window.turnstile.reset(); } catch (_) {}
  };

  function getTurnstileToken(form) {
    var input = form.querySelector('input[name="cf-turnstile-response"]');
    if (input && input.value) return input.value.trim();
    try {
      if (window.turnstile && window.turnstile.getResponse) return window.turnstile.getResponse();
    } catch (_) {}
    return '';
  }

  // Intercept form submit (AJAX)
  document.addEventListener('submit', async function (e) {
    var form = e.target.closest('form');
    if (!form) return;

    e.preventDefault();

    if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
      form.reportValidity && form.reportValidity();
      return;
    }

    setStatus(SENDING_TEXT, false);
    var btn = $('[type="submit"], #send, #submit-button');
    if (btn) { btn.setAttribute('disabled', 'true'); btn.setAttribute('aria-busy', 'true'); }

    try {
      var token = getTurnstileToken(form);
      if (!token) throw new Error('Turnstile not completed');

      var fd = new FormData(form);

      var res = await fetch(form.getAttribute('action') || '/api/contact', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: fd
      });

      var data = null;
      try { data = await res.json(); } catch (_) {}

      if (!res.ok || !data || data.ok !== true) {
        var msg = (data && (data.error || data.detail)) || ('HTTP ' + res.status);
        throw new Error(msg);
      }

      setStatus(SUCCESS_TEXT, true);
      try { form.reset(); } catch (_) {}
      try { window.turnstile && window.turnstile.reset && window.turnstile.reset(); } catch (_) {}
    } catch (err) {
      setStatus('Sorry — something went wrong: ' + (err && err.message ? err.message : String(err)), false);
    } finally {
      if (btn) { btn.removeAttribute('disabled'); btn.removeAttribute('aria-busy'); }
    }
  }, true);

  // Show success on ?sent=1 (fallback path), then clean URL
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var sent = new URL(location.href).searchParams.get('sent') === '1';
      if (sent) {
        setStatus(SUCCESS_TEXT, true);
        history.replaceState({}, '', location.pathname + (location.hash || ''));
      }
    } catch (_) {}
  });

  // Only clear success when the user edits your real fields (ignore Turnstile inputs)
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.closest('.cf-turnstile')) return;            // ignore Turnstile widget
    if (t.name === 'cf-turnstile-response') return;     // ignore hidden token
    var s = $('[data-status]');
    if (s && s.hasAttribute('data-success')) s.removeAttribute('data-success');
  }, true);
})();
