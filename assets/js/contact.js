// Contact form enhancer (diagnostic build)
// - Binds to <form data-contact> or #contactForm
// - Creates a status line if missing
// - Clear messages on success/failure
// - Works on GitHub Pages via window.CONTACT_FALLBACK_URL (absolute URL)
// - Logs useful details to the console for debugging

(() => {
  const form = document.querySelector('form[data-contact]') || document.querySelector('#contactForm');
  if (!form) {
    console.warn('[contact.js] No form found. Add data-contact to your form.');
    return;
  }

  // Find or create a status element inside the form
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

  const endpointAttr = form.getAttribute('action');
  const defaultEndpoint = 'api/contact';
  const endpoint = endpointAttr && endpointAttr.trim() ? endpointAttr.trim() : defaultEndpoint;

  const setBusy = (busy) => {
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false; // Always keep enabled in this diagnostic build
      submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  };

  const setStatus = (msg, ok = true) => {
    statusEl.textContent = msg;
    statusEl.dataset.state = ok ? 'success' : 'error';
  };

  form.addEventListener('submit', async (e) => {
    // Decide endpoint for GitHub Pages vs Cloudflare Pages
    const host = location.hostname;
    const isGithubPages = /\.github\.io$/.test(host) || host === '127.0.0.1' || host === 'localhost';
    const fallbackUrl = window.CONTACT_FALLBACK_URL; // absolute URL to your Cloudflare Pages function, e.g. https://your-site.pages.dev/api/contact

    // If on GH Pages and a fallback is provided, update form.action and let browser submit normally
    if (isGithubPages && typeof fallbackUrl === 'string' && fallbackUrl.startsWith('http')) {
      console.info('[contact.js] Using fallback URL for GitHub Pages:', fallbackUrl);
      form.action = fallbackUrl;
      return; // allow normal POST/redirect
    }

    e.preventDefault();
    setBusy(true);
    setStatus('Sending…');

    try {
      const formData = new FormData(form);

      // Turnstile token (hidden input)
      const ts = formData.get('cf-turnstile-response') || formData.get('turnstile_token');
      if (!ts) {
        setBusy(false);
        setStatus('Please complete the verification.', false);
        console.warn('[contact.js] Missing Turnstile token. Is the widget visible and sitekey correct?');
        return;
      }

      // Optional redirect parameter
      const redirectTo = formData.get('redirect');
      const target = endpoint;

      console.info('[contact.js] POST', target);
      const res = await fetch(target, {
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
        location.href = redirectTo;
        return;
      }

      // Show success message
      setStatus('Thanks — your message was sent!');
      form.reset();

      // Reset Turnstile if present
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
