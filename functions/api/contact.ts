// Cloudflare Pages Function: POST /api/contact
// Accepts either multipart/form-data or application/json
// Verifies Cloudflare Turnstile and sends the message via Resend
// Required environment variables (Cloudflare Pages → Settings → Environment variables):
//   TURNSTILE_SECRET = <your turnstile secret>
//   RESEND_API_KEY   = <your resend api key>
//   RESEND_FROM      = 'Hum Studios <hello@yourdomain.com>'
//   RESEND_TO        = 'hello@yourdomain.com'  (comma-separated list supported)
// Optional:
//   RESEND_SUBJECT_PREFIX = 'Hum Studios'
// Notes:
// - Keep your frontend posting as-is. This handler supports both multipart and JSON bodies.
// - Avoid logging PII in production.

type Env = {
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  RESEND_TO: string;
  RESEND_SUBJECT_PREFIX?: string;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  try {
    const contentType = (request.headers.get('content-type') || '').toLowerCase();

    // Parse input
    let name = '', email = '', message = '', turnstileToken = '';
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      name = (body.name || '').toString().trim();
      email = (body.email || '').toString().trim();
      message = (body.message || '').toString();
      // Accept both our custom key and Turnstile default
      turnstileToken = (body.turnstileToken || body['cf-turnstile-response'] || body['g-recaptcha-response'] || '').toString();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      name = String(form.get('name') || '').trim();
      email = String(form.get('email') || '').trim();
      message = String(form.get('message') || '');
      // Turnstile default hidden input name is cf-turnstile-response
      const tokens = form.getAll('cf-turnstile-response');
      const last = tokens.length ? tokens[tokens.length - 1] : '';
      turnstileToken = String(last || form.get('turnstileToken') || form.get('g-recaptcha-response') || '');
    } else {
      return json({ ok: false, error: 'Unsupported content type' }, 415);
    }

    // Basic validation
    if (!name || !email || !message) {
      return json({ ok: false, error: 'Missing name, email, or message' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ ok: false, error: 'Invalid email address' }, 400);
    }
    if (!turnstileToken) {
      return json({ ok: false, error: 'Missing Turnstile token' }, 400);
    }

    // Verify Turnstile token
    const verifyOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, request);
    if (!verifyOk.ok) {
      console.warn('TURNSTILE_FAIL', verifyOk.details || null);
      return json({ ok: false, error: 'Turnstile verification failed', details: verifyOk.details || null }, 400);
    }

    // Compose email
    const prefix = (env.RESEND_SUBJECT_PREFIX || '').trim();
    const subject = `${prefix ? `[${prefix}] ` : ''}New contact from ${name}`.slice(0, 200);
    const text = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.6">
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0">
        <pre style="white-space:pre-wrap;font:inherit">${escapeHtml(message)}</pre>
      </div>
    `;

    // Send via Resend
    const to = splitEmails(env.RESEND_TO);
    if (!env.RESEND_API_KEY || !env.RESEND_FROM || to.length === 0) {
      return json({ ok: false, error: 'Email not configured on server' }, 500);
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to,
        subject,
        text,
        html,
        reply_to: email,
      }),
    });

    const resendData = await safeJson(resendRes);
    if (!resendRes.ok) {
      return json({ ok: false, error: 'Resend API error', details: resendData || null }, 502);
    }

    // Minimal, privacy-conscious log
    const maskedEmail = maskEmail(email);
    console.log('CONTACT_SENT', { name, email: maskedEmail, len: message.length });

    return json({ ok: true, id: resendData.id || null });
  } catch (err: any) {
    console.error('CONTACT_ERROR', err?.stack || String(err));
    return json({ ok: false, error: 'Server error' }, 500);
  }
};

async function verifyTurnstile(token: string, secret: string, request: Request): Promise<{ ok: boolean; details?: unknown }> {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
  const data = await res.json().catch(() => null);
  return { ok: Boolean(data && data.success), details: data && data['error-codes'] };
}

function isValidEmail(v: string): boolean {
  // Lightweight email check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function splitEmails(v: string): string[] {
  return (v || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function maskEmail(e: string): string {
  return e.replace(/(.{2}).+(@.+)/, '$1***$2');
}

async function safeJson(res: Response): Promise<any> {
  try { return await res.json(); } catch { return null; }
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
