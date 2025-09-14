// Progressive enhancement for the contact form.
// - Submits to relative 'api/contact' (Pages Function) with fetch
// - Gracefully falls back to normal form POST if JS fails
// - Reads Turnstile token from the auto-inserted hidden input
(() => {
  const form = document.querySelector('form[data-contact]');
  if (!form) return;

  const endpoint = form.getAttribute('action') || 'api/contact';
  const submitBtn = form.querySelector('[type="submit"]');
  const statusEl = form.querySelector('[data-status]');

  const setBusy = (busy) => {
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    submitBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
  };
  const setStatus = (msg, ok = true) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.dataset.state = ok ? 'success' : 'error';
  };

  form.addEventListener('submit', async (e) => {
    // If the page is running on GitHub Pages, allow any existing fallback (action) to proceed.
    const host = location.hostname;
    const isGithubPages = /\.github\.io$/.test(host) || host === '127.0.0.1' || host === 'localhost';
    const fallbackUrl = window.CONTACT_FALLBACK_URL;
    if (isGithubPages && fallbackUrl) {
      form.action = fallbackUrl;
      return; // let the browser submit normally
    }

    e.preventDefault();
    setBusy(true);

    try {
      const formData = new FormData(form);
      // Ensure Turnstile token is present (hidden field name usually 'cf-turnstile-response')
      const ts = formData.get('cf-turnstile-response') || formData.get('turnstile_token');
      if (!ts) {
        setBusy(false);
        setStatus('Please complete the verification.', false);
        return;
      }

      // Support redirect after success via a hidden <input name="redirect" value="/thanks.html">
      const redirectTo = formData.get('redirect');

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Send failed');
      }

      if (redirectTo) {
        location.href = redirectTo;
        return;
      }

      setStatus('Thanks — your message was sent!');
      form.reset();
      // Reset Turnstile widget if present
      if (window.turnstile && typeof window.turnstile.reset === 'function') {
        try { window.turnstile.reset(); } catch {}
      }
    } catch (err) {
      console.error(err);
      setStatus('Sorry, something went wrong. Please try again.', false);
    } finally {
      setBusy(false);
    }
  });
})();
