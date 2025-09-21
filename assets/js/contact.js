// /assets/js/contact.js
// Classic form submit (no AJAX). Shows "Sending…", enables the button after Turnstile,
// and renders an inline success message when redirected back with ?sent=1.

(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }

  // Called by Turnstile widget via data-callback="enableSubmit"
  window.enableSubmit = function enableSubmit() {
    var btn = $('[type="submit"], #send, #submit-button');
    if (btn) btn.removeAttribute('disabled');
    var s = $('[data-status]');
    if (s) s.textContent = '';
  };

  // Optional: called by Turnstile via data-error-callback="tsError"
  window.tsError = function tsError(code) {
    var s = $('[data-status]');
    if (s) {
      s.textContent = 'We couldn’t verify you (' + code + '). '
        + 'If you use privacy extensions, allow challenges.cloudflare.com and try again.';
    }
    try { window.turnstile && window.turnstile.reset && window.turnstile.reset(); } catch (_) {}
  };

  // Show inline success when the server redirected back with ?sent=1
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var sent = new URL(location.href).searchParams.get('sent') === '1';
      if (sent) {
        var s = $('[data-status]');
        if (s) s.textContent = 'Thanks — your message was sent!';
        // Optional: clean the URL (keep hash)
        // history.replaceState({}, '', location.pathname + (location.hash || ''));
      }
    } catch (_) {}
  });

  // While the browser navigates after submit, show a sending state (no preventDefault!)
  document.addEventListener('submit', function () {
    var s = $('[data-status]');
    if (s) s.textContent = 'Sending…';
    var btn = $('[type="submit"], #send, #submit-button');
    if (btn) btn.setAttribute('aria-busy', 'true');
  }, true);
})();
