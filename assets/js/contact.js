// Contact form enhancer (environment-aware, no external snippet required)
// - Binds to <form data-contact> or #contactForm
// - Creates a status line if missing
// - Works on GitHub Pages/localhost by auto-targeting production endpoint
// - Respects global override: window.CONTACT_FALLBACK_URL
// - Avoids cross-origin CORS issues by falling back to a plain form POST when needed
// - Clear messages on success/failure; resets Turnstile on success

(() => {
  const form = document.querySelector('form[data-contact]') || document.querySelector('#contactForm');
  if (!form) {
    console.warn('[contact.js] No form found. Add data-contact to your form.');
    return;
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
    const postUrl = resolvePostUrl();
    const willBeCrossOrigin = isCrossOrigin(postUrl);
    const isProd = isProdHost && !willBeCrossOrigin; // same-origin in production

    // Always require Turnstile token before submitting (both fetch and plain POST paths)
    const formData = new FormData(form);
    const ts = formData.get('cf-turnstile-response') || formData.get('turnstile_token');
    if (!ts) {
      e.preventDefault();
      setStatus('Please complete the verification.', false);
      console.warn('[contact.js] Missing Turnstile token. Is the widget visible and sitekey correct?');
      return;
    }

    // If posting cross-origin (e.g., GH Pages → production), avoid CORS by letting the browser
    // perform a normal form POST to the absolute URL. This sacrifices inline status updates, but
    // guarantees submission without requiring server CORS headers.
    if (willBeCrossOrigin && !isProdHost) {
      console.info('[contact.js] Cross-origin environment detected; using plain form POST to', postUrl);
      form.action = postUrl;
      // Let the browser submit normally (do not preventDefault)
      return;
    }

    // Same-origin path: enhance with fetch + inline status
    e.preventDefault();
    setBusy(true);
    setStatus('Sending…');

    try {
      // Include any existing fields; supports multipart/form-data
      const redirectTo = formData.get('redirect');

      console.info('[contact.js] POST', postUrl);
      const res = await fetch(postUrl, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');

      if (!res.ok) {
        let errText = 'Send failed';
        try {
          const payload = isJson ? await res.json() : await res.text();
          errText = (payload && payload.error) || (typeof payload === 'string' ? payload : errText);
          console.error('[contact.js] Server error:', payload);
        } catch {}
        throw new Error(errText);
      }

      if (redirectTo) {
        location.href = redirectTo.toString();
        return;
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
