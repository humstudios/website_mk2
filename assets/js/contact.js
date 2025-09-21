// /assets/js/contact.js
// AJAX submit (no reload). Works with Cloudflare Turnstile.
// - Enables the button when Turnstile completes
// - Submits via fetch and shows inline success/error
// - Resets Turnstile after a successful send

// Let the page know our AJAX handler is ready (prevents fallback from running)
window.__contactAjaxReady = true;

(function () {
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

  // Utility: get Turnstile token from hidden input (most reliable), with fallback
  function getTurnstileToken(form) {
    var input = form.querySelector('input[name="cf-turnstile-response"]');
    if (input && input.value) return input.value.trim();
    try {
      if (window.turnstile && window.turnstile.getResponse) {
        return window.turnstile.getResponse();
      }
    } catch (_) {}
    return '';
  }

  // Intercept form submit (AJAX)
  document.addEventListener('submit', async function (e) {
    var form = e.target.closest('form');
    if (!form) return;

    e.preventDefault();

    // Built-in browser validation
    if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
      form.reportValidity && form.reportValidity();
      return;
    }

    // Status + disable button
    setStatus(SENDING_TEXT, false);
    var btn = $('[type="submit"], #send, #submit-button');
    if (btn) { btn.setAttribute('disabled', 'true'); btn.setAttribute('aria-busy', 'true'); }

    try {
      // Ensure we have a Turnstile token
      var token = getTurnstileToken(form);
      if (!token) throw new Error('Turnstile not completed');

      // Send as FormData (works with your Pages Function)
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

      // Success: show message, reset form + Turnstile
      setStatus(SUCCESS_TEXT, true);
      try { form.reset(); } catch (_) {}
      try { window.turnstile && window.turnstile.reset && window.turnstile.reset(); } catch (_) {}
    } catch (err) {
      setStatus('Sorry — something went wrong: ' + (err && err.message ? err.message : String(err)), false);
    } finally {
      if (btn) { btn.removeAttribute('disabled'); btn.removeAttribute('aria-busy'); }
    }
  }, true);

  // If server ever redirects back with ?sent=1 (fallback path), still show success
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var sent = new URL(location.href).searchParams.get('sent') === '1';
      if (sent) {
        setStatus(SUCCESS_TEXT, true);
        history.replaceState({}, '', location.pathname + (location.hash || ''));
      }
    } catch (_) {}
  });

  // Typing clears success state
  document.addEventListener('input', function () {
    var s = $('[data-status]');
    if (s && s.hasAttribute('data-success')) s.removeAttribute('data-success');
  }, true);
})();
