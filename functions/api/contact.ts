// Diagnostic variant: logs config presence booleans before checks
type Env = {
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  RESEND_TO: string;
  RESEND_SUBJECT_PREFIX?: string;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const stage = (s: string, extra?: Record<string, unknown>) => console.log('CONTACT_STAGE', s, extra || {});

  try {
    stage('start', { contentType: request.headers.get('content-type') });

    const contentType = (request.headers.get('content-type') || '').toLowerCase();

    // Parse input
    let name = '', email = '', message = '', turnstileToken = '';

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      stage('parsed_json');
      name = (body.name || '').toString().trim();
      email = (body.email || '').toString().trim();
      message = (body.message || '').toString();
      const t = flatArray([body.turnstileToken, body['cf-turnstile-response'], body['g-recaptcha-response']]);
      turnstileToken = lastNonEmpty(t);
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      stage('parsed_form', { keys: Array.from(form.keys()) });
      name = String(form.get('name') || '').trim();
      email = String(form.get('email') || '').trim();
      message = String(form.get('message') || '');
      const tokens = formAll(form, 'cf-turnstile-response')
        .concat(formAll(form, 'turnstileToken'))
        .concat(formAll(form, 'g-recaptcha-response'));
      turnstileToken = lastNonEmpty(tokens);
    } else {
      stage('unsupported_content_type');
      return jerr('UNSUPPORTED_CONTENT_TYPE', 415, 'Unsupported content type');
    }

    // Basic validation
    if (!name || !email || !message) {
      stage('validation_fail', { name: !!name, email: !!email, message: !!message });
      return jerr('MISSING_FIELDS', 400, 'Missing name, email, or message');
    }
    if (!isValidEmail(email)) {
      stage('validation_fail_email', { email });
      return jerr('INVALID_EMAIL', 400, 'Invalid email address');
    }
    if (!turnstileToken) {
      stage('missing_turnstile');
      return jerr('MISSING_TURNSTILE', 400, 'Missing Turnstile token');
    }

    // Config presence log (booleans only)
    stage('config_presence', {
      hasTurnstileSecret: !!env.TURNSTILE_SECRET,
      hasResendApiKey: !!env.RESEND_API_KEY,
      hasResendFrom: !!env.RESEND_FROM,
      hasResendTo: !!env.RESEND_TO
    });

    // Config check
    if (!env.TURNSTILE_SECRET) return jerr('CONFIG_TURNSTILE_SECRET', 500, 'TURNSTILE_SECRET missing');
    if (!env.RESEND_API_KEY)   return jerr('CONFIG_RESEND_API_KEY', 500, 'RESEND_API_KEY missing');
    if (!env.RESEND_FROM)      return jerr('CONFIG_RESEND_FROM', 500, 'RESEND_FROM missing');
    if (!env.RESEND_TO)        return jerr('CONFIG_RESEND_TO', 500, 'RESEND_TO missing');

    // Verify Turnstile
    stage('verify_turnstile_begin');
    const verifyOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, request);
    stage('verify_turnstile_end', verifyOk);
    if (!verifyOk.ok) {
      return jerr('TURNSTILE_FAIL', 400, 'Turnstile verification failed', verifyOk.details || null);
    }

    // Compose email & send via Resend (identical to previous file)
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

    stage('resend_begin');
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: splitEmails(env.RESEND_TO),
        subject,
        text,
        html,
        reply_to: email,
      }),
    });
    const resendData = await safeJson(resendRes);
    stage('resend_end', { status: resendRes.status, ok: resendRes.ok, id: resendData && resendData.id });

    if (!resendRes.ok) {
      return jerr('RESEND_API_ERROR', 502, 'Resend API error', resendData || null);
    }

    const maskedEmail = maskEmail(email);
    console.log('CONTACT_SENT', { name, email: maskedEmail, len: message.length });

    return json({ ok: true, id: resendData.id || null });
  } catch (err: any) {
    console.error('CONTACT_ERROR', err?.stack || String(err));
    return jerr('SERVER_ERROR', 500, 'Server error');
  }
};

function flatArray(x: any): string[] {
  const arr = Array.isArray(x) ? x : [x];
  return arr.filter(v => v !== undefined && v !== null).map(v => String(v));
}

function lastNonEmpty(arr: string[]): string {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = (arr[i] || '').trim();
    if (v) return v;
  }
  return '';
}

function formAll(form: FormData, key: string): string[] {
  const vals = form.getAll(key);
  return vals.map(v => String(v || ''));
}

async function verifyTurnstile(token: string, secret: string, request: Request): Promise<{ ok: boolean; details?: unknown }> {
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formData });
  const data = await res.json().catch(() => null);
  return { ok: Boolean(data && (data as any).success), details: data && (data as any)['error-codes'] };
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function splitEmails(v: string): string[] {
  return (v || '').split(',').map(s => s.trim()).filter(Boolean);
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function maskEmail(e: string): string {
  return String(e).replace(/(.{2}).+(@.+)/, '$1***$2');
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

function jerr(code: string, status: number, error: string, details?: unknown): Response {
  return json({ ok: false, code, error, details: details || null }, status);
}
