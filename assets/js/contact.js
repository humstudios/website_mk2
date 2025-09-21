// contact.simple.js — classic submit (no AJAX). Inline UX, then let the browser POST the form.
(function () {
  const form = document.querySelector('form[data-contact]') || document.querySelector('#contactForm');
  if (!form) return;

  // Ensure method/action (adjust action to your Worker URL if /api/contact isn't routed yet)
  if (!form.getAttribute('method')) form.setAttribute('method', 'POST');

  // status line (optional)
  let statusEl = form.querySelector('[data-status]');
  if (!statusEl) {
    statusEl = document.createElement('p');
    statusEl.setAttribute('data-status', '');
    statusEl.setAttribute('aria-live', 'polite');
    form.appendChild(statusEl);
  }
  function setStatus(msg) { statusEl.textContent = msg || ''; }

  // Global callback for Turnstile
  window.enableSubmit = function () {
    const btn = form.querySelector('[type="submit"], #send, #submit-button');
    btn && btn.removeAttribute('disabled');
    setStatus(''); // clear any previous error
  };

  // DO NOT preventDefault — allow a normal form POST to your Worker
  form.addEventListener('submit', () => {
    const btn = form.querySelector('[type="submit"], #send, #submit-button');
    btn && btn.setAttribute('disabled', 'true');
    setStatus('Sending…');
  });

  // If we landed here after a redirect (?sent=1), show success
  try {
    if (new URL(location.href).searchParams.get('sent') === '1') setStatus('Thanks — your message was sent!');
  } catch {}
})();
