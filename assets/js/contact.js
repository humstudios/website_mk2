// Improved client: show server error details to the user
(function () {
  function $(s) { return document.querySelector(s); }
  const form = $('#contact-form');
  if (!form) return;

  const sendBtn = $('#submit-button') || $('#send') || form.querySelector('button[type="submit"]');
  const statusEl = $('#status') || document.createElement('div');
  if (!statusEl.id) { statusEl.id = 'status'; form.appendChild(statusEl); }

  function setStatus(msg, type) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status ' + (type || '');
  }
  function setBusy(b) {
    if (sendBtn) sendBtn.disabled = !!b;
  }

  form.addEventListener('submit', async (e) => {
    setStatus('');
    setBusy(true);
    try {
      const body = new FormData(form);
      const endpoint = (window.CONTACT_FALLBACK_URL || 'api/contact');
      const res = await fetch(endpoint, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const parts = [];
        if (data.error) parts.push(data.error);
        if (data.code) parts.push('(' + data.code + ')');
        if (data.details && Array.isArray(data.details)) parts.push(String(data.details[0] || ''));
        setStatus('Sorry, something went wrong. ' + parts.filter(Boolean).join(' '), 'error');
        console.error('[contact] server error', res.status, data);
        return;
      }
      setStatus('Thanks! Your message was sent.', 'success');
      form.reset();
      if (window.turnstile && window.turnstile.reset) window.turnstile.reset();
    } catch (err) {
      console.error('[contact] submit failed', err);
      setStatus('Sorry, sending failed. ' + (err && err.message ? err.message : ''), 'error');
    } finally {
      setBusy(false);
    }
  });
})();