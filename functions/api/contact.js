// /functions/api/contact.js

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  // --- Parse body (FormData or JSON) ---
  const ct = request.headers.get('content-type') || '';
  let form;
  if (ct.includes('form')) {
    form = await request.formData();
  } else if (ct.includes('json')) {
    const body = await request.json().catch(() => ({}));
    form = new Map(Object.entries(body));
    form.get = (k) => body[k];
  } else {
    return json({ ok: false, error: 'Unsupported content type' }, 415);
  }

  // --- Turnstile token ---
  const token = form.get('cf-turnstile-response');
  console.log('contact: token?', !!token, 'len:', token?.length);

  // --- Verify with Turnstile ---
  let verify = { success: false };
  try {
    const vRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET || '',
        response: token || '',
        remoteip: request.headers.get('CF-Connecting-IP') || ''
      })
    });
    verify = await vRes.json();
  } catch (err) {
    console.error('contact: verify fetch error', String(err));
  }
  console.log('contact: turnstile verify', verify.success, verify['error-codes']);

  if (!verify.success) {
    return json({ ok: false, error: 'Turnstile failed', detail: verify['error-codes'] || [] }, 403);
  }

  // --- Compose message ---
  const name    = (form.get('name')    || 'Anonymous').toString();
  const email   = (form.get('email')   || '').toString();
  const website = (form.get('website') || '').toString();
  const message = (form.get('message') || '').toString();

  const text = `Name: ${name}
Email: ${email}
Website: ${website}

Message:
${message}
`;

  // --- Send email via MailChannels (no extra libs) ---
  try {
    const mailResp = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: env.CONTACT_TO, name: 'Hum Studios' }] }],
        from: { email: env.CONTACT_FROM || 'noreply@humstudios.com', name: 'Hum Studios Website' },
        headers: email ? { 'Reply-To': email } : undefined,
        subject: 'New website contact',
        content: [{ type: 'text/plain', value: text }]
      })
    });
    console.log('contact: mail status', mailResp.status);
    if (!mailResp.ok) {
      const errTxt = await mailResp.text();
      console.error('contact: mail error', errTxt.slice(0, 500));
      return json({ ok: false, error: 'Email send failed' }, 502);
    }
  } catch (err) {
    console.error('contact: mail fetch error', String(err));
    return json({ ok: false, error: 'Email send error' }, 502);
  }

  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
