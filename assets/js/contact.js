// /assets/js/contact.js (client-side, progressive enhancement)
// Keeps native form POST as a fallback; enhances with fetch when available.
(() => {
  const f   = document.getElementById('contactForm');
  const btn = document.getElementById('submit-button');
  if (!f || !btn || !window.fetch) return;

  // Turnstile callback hook: enable submit when token is ready
  window.enableSubmit = function () { try { btn.disabled = false; } catch (e) {} };
 // fallback to native submit if missing

  f.addEventListener('submit', async (e) => {
    // If the form has no action/method, let native submit happen.
    const action = f.getAttribute('action') || '';
    const method = (f.getAttribute('method') || 'post').toLowerCase();
    if (!action || method !== 'post') return;

    e.preventDefault();               // switch to AJAX
    btn.disabled = true;

    try {
      const fd = new FormData(f);

      // Guard: ensure Turnstile token exists
      const token = fd.get('cf-turnstile-response');
      if (!token) {
        alert('Please complete the security check and try again.');
        return;
      }

      const res  = await fetch(action, {
        method: 'POST',
        body: fd,
        headers: { 'X-Requested-With': 'hum-contact' }
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data && (data.ok === true || data.status === 'ok')) {
        f.reset();
        alert('Thanks! Your message has been sent.');
      } else {
        console.error('send failed', res.status, data);
        alert('Sorry, that didn’t send. Please try again.');
      }
    } catch (err) {
      console.error('send error', err);
      alert('Network error. Please try again.');
    } finally {
      btn.disabled = false;
    }
  }, { passive: false });
})();
