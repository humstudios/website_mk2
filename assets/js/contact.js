// contact.js — final (self-contained, AJAX-only, inline status)
(() => {
  const form = document.querySelector('form[data-contact]') || document.querySelector('#contactForm');
  if (!form) {
    console.warn('[contact.js] No form found. Add data-contact to your form.');
    return;
  }

  // ---------- Status + busy ----------
  let statusEl = form.querySelector('[data-status]');
  if (!statusEl) {
    statusEl = document.createElement('p');
    statusEl.setAttribute('data-status', '');
    statusEl.setAttribute('aria-live', 'polite');
    form.appendChild(statusEl);
  }
  function setStatus(msg, ok = true) {
    statusEl.textContent = msg || '';
    statusEl.dataset.ok = ok ? '1' : '0';
  }
  function setBusy(b) {
    const btn = form.querySelector('[type="submit"], #send, #submit-button');
    if (b) btn && btn.setAttribute('disabled', 'true'); else btn && btn.removeAttribute('disabled');
    form.classList.toggle('is-busy', !!b);
  }

  // ---------- Endpoint resolution ----------
  const isGH = location.hostname.endsWith('github.io');
  const REL_PROD = '/api/contact';
  const ABS_PROD = 'https://www.humstudios.com/api/contact';
  const hasAbsolute = (s) => /^https?:\/\//i.test(s || '');

  const endpointFromAction = (() => {
    const a = (form.getAttribute('action') || '').trim();
    return a || null;
  })();

  function bestEndpoint() {
    if (typeof window !== 'undefined' && window.CONTACT_FALLBACK_URL) return String(window.CONTACT_FALLBACK_URL);
    if (endpointFromAction) return endpointFromAction;
    return isGH ? ABS_PROD : REL_PROD;
  }

  function isCrossOrigin(url) {
    try { return new URL(url, location.href).origin !== location.origin; } catch { return false; }
  }

  // ---------- Collect + token ----------
  function collect() {
    const get = (sel) => form.querySelector(sel);
    const val = (sel) => (get(sel)?.value || '').toString().trim();
    return {
      email: val('[name="email"]'),
      name: val('[name="name"]'),
      message: val('[name="message"]')
    };
  }

  function getToken() {
    // Prefer hidden input injected by Turnstile
    const hidden = form.querySelector('input[name="cf-turnstile-response"]');
    if (hidden && hidden.value) return hidden.value;
    try {
      if (window.turnstile && typeof window.turnstile.getResponse === 'function') {
        return window.turnstile.getResponse();
      }
    } catch {}
    return '';
  }

  // ---------- AJAX ----------
  async function postJSON(url, data) {
    const target = new URL(url, location.href).toString();
    const cors = isCrossOrigin(target);
    return fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      mode: cors ? 'cors' : 'same-origin',
      credentials: 'omit'
    });
  }

  // ---------- Submit ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus('Sending…');
    try {
      const data = collect();
      if (!data.email || !data.message) {
        setStatus('Please provide your email and a message.', false);
        return;
      }
      const token = getToken();
      if (!token) {
        setStatus('Please complete the verification.', false);
        return;
      }
      data.turnstileToken = token;

      const endpoint = bestEndpoint();
      const res = await postJSON(endpoint, data);

      const text = await res.text().catch(() => '');
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch {}

      if (!res.ok) {
        const detail = (payload && (payload.detail || payload.error)) || text || ('HTTP ' + res.status);
        setStatus('Sorry, something went wrong. ' + String(detail), false);
        return;
      }
      if (!payload || payload.ok !== true) {
        const detail = (payload && (payload.detail || payload.error)) || 'Unknown error';
        setStatus('Sorry, something went wrong. ' + String(detail), false);
        return;
      }

      setStatus('Thanks — your message was sent!');
      form.reset();
      try { window.turnstile && window.turnstile.reset && window.turnstile.reset(); } catch {}
    } catch (err) {
      console.error('[contact.js] Error:', err);
      setStatus('Sorry, something went wrong. ' + (err?.message || ''), false);
    } finally {
      setBusy(false);
    }
  });
})();