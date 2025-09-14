export async function onRequestPost({ request, env }) {
  const log = (...a) => console.log("contact:", ...a);

  // --- parse form ---
  const form = await request.formData();
  const name = (form.get("name") || "").toString().trim();
  const email = (form.get("email") || "").toString().trim();
  const message = (form.get("message") || "").toString().trim();
  const honeypot = (form.get("website") || "").toString().trim();
  const token = (form.get("cf-turnstile-response") || "").toString();

  if (honeypot) return json({ ok: true }); // silent drop

  // --- Turnstile verify ---
  const secret = env.TURNSTILE_SECRET;
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
  });
  const verify = await verifyRes.json().catch(() => ({}));
  log("turnstile", verify.success, verify["error-codes"] || []);
  if (!verify.success) return json({ ok: false, error: "turnstile" }, 403);

  // --- basic validation ---
  if (!name || !email || !message) return json({ ok: false, error: "missing_fields" }, 400);

  // --- compose email ---
  const CONTACT_TO = env.CONTACT_TO;                 // your Gmail
  const CONTACT_FROM = env.CONTACT_FROM || `no-reply@${new URL(request.url).hostname}`;
  const subject = `New contact from ${name}`;
  const text = `From: ${name} <${email}>\n\n${message}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
      <p><strong>From:</strong> ${escape(name)} &lt;${escape(email)}&gt;</p>
      <pre style="white-space:pre-wrap">${escape(message)}</pre>
    </div>`;

  // --- try RESEND first if key present (easy & reliable) ---
  if (env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Hum Studios <${CONTACT_FROM}>`,
        to: [CONTACT_TO],
        subject,
        text,
        html,
        reply_to: email,
      }),
    });
    const body = await safeText(r);
    log("resend status", r.status, body.slice(0, 200));
    if (r.ok) return json({ ok: true });
    return json({ ok: false, provider: "resend", status: r.status, body }, 502);
  }

  // --- otherwise use MailChannels (works best when CONTACT_FROM domain is in your Cloudflare account) ---
  const mcPayload = {
    personalizations: [{ to: [{ email: CONTACT_TO }] }],
    from: { email: CONTACT_FROM, name: "Hum Studios" },
    subject,
    content: [
      { type: "text/plain", value: text },
      { type: "text/html", value: html },
    ],
    reply_to: { email, name },
  };

  const mcUrl = "https://api.mailchannels.net/tx/v1/send";
  const mcRes = await fetch(mcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mcPayload),
  });
  const mcBody = await safeText(mcRes);
  log("mailchannels status", mcRes.status, mcBody.slice(0, 200));

  if (mcRes.status === 202 || mcRes.status === 200) return json({ ok: true });
  return json({ ok: false, provider: "mailchannels", status: mcRes.status, body: mcBody }, 502);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
function escape(s) {
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
async function safeText(r) { try { return await r.text(); } catch { return ""; } }
