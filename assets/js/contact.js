// Contact form enhancer (environment-aware, no external snippet required)
// - Binds to <form data-contact> or #contactForm
// - Creates a status line if missing
// - Works on GitHub Pages/localhost by auto-targeting production endpoint
// - Respects global override: window.CONTACT_FALLBACK_URL
//// - Clear messages on success/failure; resets Turnstile on success

(() => {
  const form = document.querySelector('form[data-contact]') || document.querySelector('#contactForm');
  if (!form) {
    console.warn('[contact.js] No form found. Add data-contact to your form.');
    return;
  }

  async function postJSON(url, data) {
    const absolute = hasAbsolute(url);
    const target = absolute ? new URL(url, location.href).toString() : url;
    const cors = absolute && new URL(target).origin !== location.origin;
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      mode: cors ? 'cors' : 'same-origin',
      credentials: 'omit'
    });
    return res;
  }


  // ---------- Environment-aware endpoint resolution ----------
  // 1) If the form has an absolute action, use it.
  // 2) Else if window.CONTACT_FALLBACK_URL exists, use it.
  // 3) Else choose by host: production => relative /api/contact, otherwise absolute prod URL.
  const PROD_HOSTS = new Set(['humstudios.com', 'www.humstudios.com']);
  const isPagesDev = /\.pages\.dev$/i.test(location.hostname);
  const isProdHost = PROD_HOSTS.has(location.hostname) || isPagesDev;

  const ABS_PROD_ENDPOINT = 'https://www.humstudios.com/api/contact';
  const REL_PROD_ENDPOINT = '/api/contact';

  const hasAbsolute = (url) => /^(https?:)?\/\//i.test(url || '');
  const isCrossOrigin = (url) => {
    try { return new URL(url, location.href).origin !== location.origin; }
    catch { return false; }
  };

  // Resolve the endpoint in a way that keeps control centralized here.
  const actionAttr = (form.getAttribute('action') || '').trim();
  const FORM_ABSOLUTE = hasAbsolute(actionAttr) ? actionAttr : null;

  const CONTACT_ENDPOINT_DEFAULT = isProdHost ? REL_PROD_ENDPOINT : ABS_PROD_ENDPOINT;
  const CONTACT_ENDPOINT = (typeof window !== 'undefined' && window.CONTACT_FALLBACK_URL) || CONTACT_ENDPOINT_DEFAULT;

  // Compute the best target:
  // - Prefer absolute action if present
  // - Else if form has a relative action, keep it on prod, otherwise fall back to our resolver
  // - Else use our resolver directly
  const resolvePostUrl = () => {
    if (FORM_ABSOLUTE) return FORM_ABSOLUTE;
    if (actionAttr && !hasAbsolute(actionAttr)) {
      // Relative action in markup
      return isProdHost ? actionAttr : CONTACT_ENDPOINT;
    }
    return CONTACT_ENDPOINT;
  };

  // ---------- Status helpers ----------
  let statusEl = form.querySelector('[data-status]');
  if (!statusEl) {
    statusEl = document.createElement('p');
    statusEl.setAttribute('data-status', '');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.className = 'status';
    statusEl.style.minHeight = '1.25em';
    statusEl.style.marginTop = '.75rem';
    form.appendChild(statusEl);
  }

  const setBusy = (busy) => {
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false; // keep enabled; communicate busy via aria
      submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  };

  const setStatus = (msg, ok = true) => {
    statusEl.textContent = msg;
    statusEl.dataset.state = ok ? 'success' : 'error';
  };

  // ---------- Submit handling ----------
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus('Sending…');
    try {
      // Collect data
      const data = collect();
      if (!data.email || !data.message) {
        setStatus('Please provide your email and a message.', false);
        return;
      }
      // Turnstile token
      const token = getToken();
      if (!token) {
        setStatus('Please complete the verification.', false);
        return;
      }
      data.turnstileToken = token;

      // Choose endpoint and always AJAX
      const endpoint = bestTarget();
      const res = await postJSON(endpoint, data);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + (txt ? (' — ' + txt) : ''));
      }
      const payload = await res.json().catch(() => ({}));
      if (!payload || payload.ok !== true) {
        throw new Error('Server did not confirm ok');
      }

      setStatus('Thanks — your message was sent!');
      form.reset();
      if (window.turnstile && typeof window.turnstile.reset === 'function') {
        try { window.turnstile.reset(); } catch {}
      }
    } catch (err) {
      console.error('[contact.js] Error:', err);
      setStatus('Sorry, something went wrong. Please try again.', false);
    } finally {
      setBusy(false);
    }
  });
})();
