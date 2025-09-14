// Cloudflare Pages Function: /functions/api/contact.js
// Handles POSTs from your contact form, verifies Cloudflare Turnstile, and sends via Resend.
// Environment variables required (set in Cloudflare Pages project settings):
// - RESEND_API_KEY
// - CONTACT_TO              (e.g. "hello@humstudios.com")
// - CONTACT_FROM            (e.g. "Hum Studios <no-reply@send.humstudios.com>" from a verified Resend domain/subdomain)
// - TURNSTILE_SECRET_KEY
// Optional: CONTACT_SUBJECT (defaults to "New contact form message")
// Optional: CONTACT_CC, CONTACT_BCC (comma-separated lists)
// Optional: CONTACT_ALLOWED_ORIGIN (for CORS in dev/preview; defaults to request origin)

const JSON_TYPE = "application/json; charset=utf-8";

function corsHeaders(origin) {
  const allow = origin || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export async function onRequestOptions({ request, env }) {
  const origin = request.headers.get("Origin") || undefined;
  const allow = env.CONTACT_ALLOWED_ORIGIN || origin;
  return new Response(null, { status: 204, headers: corsHeaders(allow) });
}

export async function onRequestPost({ request, env }) {
  try {
    // --- Basic safety checks ---
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > 100 * 1024) {
      return json({ ok: false, error: "Payload too large." }, 413, request, env);
    }

    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    const accept = (request.headers.get("accept") || "").toLowerCase();

    // Parse body (supports JSON and URL-encoded/multipart forms)
    let data = {};
    if (contentType.includes("application/json")) {
      data = await request.json();
    } else {
      const form = await request.formData();
      for (const [k, v] of form.entries()) data[k] = typeof v === "string" ? v : String(v.name || "file");
    }

    // Normalise fields
    const name = (data.name || "").toString().trim().slice(0, 200);
    const email = (data.email || data.replyTo || "").toString().trim().slice(0, 200);
    const message = (data.message || data.body || "").toString().trim().slice(0, 5000);
    const subject = (data.subject || env.CONTACT_SUBJECT || "New contact form message").toString().trim().slice(0, 200);

    // Turnstile token can come from the default hidden field or custom field
    const tsToken = (data["cf-turnstile-response"] || data["turnstile_token"] || "").toString();

    // Validate required fields
    if (!name || !email || !message) {
      return json({ ok: false, error: "Please provide name, email, and message." }, 400, request, env);
    }

    if (!validateEmail(email)) {
      return json({ ok: false, error: "Please provide a valid email address." }, 400, request, env);
    }
    if (!tsToken) {
      return json({ ok: false, error: "Turnstile verification missing." }, 400, request, env);
    }

    // Verify Turnstile with siteverify API
    const clientIp = request.headers.get("CF-Connecting-IP") || undefined;
    const verifyBody = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY || "",
      response: tsToken,
      ...(clientIp ? { remoteip: clientIp } : {}),
    });
    const tsResp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verifyBody,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const tsJson = await tsResp.json();
    if (!tsJson.success) {
      return json({ ok: false, error: "Turnstile verification failed.", details: tsJson["error-codes"] || null }, 403, request, env);
    }

    // Compose Resend payload
    const to = splitEmails(env.CONTACT_TO);
    const cc = splitEmails(env.CONTACT_CC);
    const bcc = splitEmails(env.CONTACT_BCC);
    const from = env.CONTACT_FROM;
    const replyTo = email;

    if (!env.RESEND_API_KEY || !from || !to.length) {
      return json({ ok: false, error: "Server misconfiguration: missing email settings." }, 500, request, env);
    }

    // Simple HTML + text bodies
    const escaped = (s) => s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; line-height:1.6">
        <h2 style="margin:0 0 12px 0">New contact message</h2>
        <p><strong>Name:</strong> ${escaped(name)}</p>
        <p><strong>Email:</strong> ${escaped(email)}</p>
        ${data.phone ? `<p><strong>Phone:</strong> ${escaped(String(data.phone))}</p>` : ""}
        <hr style="border:none;border-top:1px solid #ddd; margin:16px 0" />
        <pre style="white-space:pre-wrap;word-wrap:break-word;font:inherit">${escaped(message)}</pre>
      </div>
    `;
    const text = `New contact message

Name: ${name}
Email: ${email}
${data.phone ? `Phone: ${String(data.phone)}\n` : ""}
---
${message}
`;

    const payload = {
      from,
      to,
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      // You can add "tags" or "headers" here if needed
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ ok: false, error: "Email send failed.", provider_status: res.status, provider_body: errText }, 502, request, env);
    }

    // If the form included a redirect URL and Accept prefers HTML, do a post-redirect-get.
    const wantsHTML = accept.includes("text/html") || contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
    const redirectURL = (data.redirect || "").toString();
    if (wantsHTML && redirectURL) {
      return Response.redirect(redirectURL, 303);
    }

    return json({ ok: true, message: "Sent" }, 200, request, env);
  } catch (err) {
    return json({ ok: false, error: "Server error.", detail: String(err && err.stack || err) }, 500, request, env);
  }
}

// Helpers
function splitEmails(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function validateEmail(e) {
  // Minimal validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}
function json(obj, status, request, env) {
  const origin = request.headers.get("Origin") || undefined;
  const allow = env.CONTACT_ALLOWED_ORIGIN || origin;
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": JSON_TYPE, ...corsHeaders(allow) },
  });
}
