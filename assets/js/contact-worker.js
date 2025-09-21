// contact-worker.js
// Cloudflare Worker for Hum Studios contact form
// - Accepts JSON or multipart/form-data
// - Verifies Cloudflare Turnstile
// - CORS for GitHub Pages + Production
// - Optionally sends via MailChannels (set MAIL_TO + MAIL_FROM env vars)

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = makeCorsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Not Found" }, 404, cors);
    }

    // 1) Parse request (JSON or multipart)
    let payload;
    try {
      payload = await parsePayload(request);
    } catch (err) {
      return json({ error: "Invalid request body", detail: err.message }, 400, cors);
    }

    // 2) Extract fields
    const name = (payload.name || "").toString().trim();
    const email = (payload.email || "").toString().trim();
    const message = (payload.message || "").toString().trim();
    const token = getTurnstileToken(payload);

    if (!email || !message) {
      return json({ error: "Missing required fields: email, message" }, 400, cors);
    }
    if (!token) {
      return json({ error: "Missing Turnstile token" }, 400, cors);
    }

    // 3) Verify Turnstile
    try {
      const verify = await verifyTurnstile(token, request, env);
      if (!verify.success) {
        return json({ error: "Turnstile verification failed", detail: verify["error-codes"] || null }, 403, cors);
      }
      // Optional: lock down accepted hostnames
      if (env.TURNSTILE_ENFORCE_HOSTNAME === "1") {
        const expected = new Set((env.TURNSTILE_ALLOWED_HOSTNAMES || "").split(",").map(s => s.trim()).filter(Boolean));
        if (expected.size && !expected.has(verify.hostname)) {
          return json({ error: "Unexpected hostname", hostname: verify.hostname }, 403, cors);
        }
      }
    } catch (err) {
      return json({ error: "Turnstile verification error", detail: err.message }, 502, cors);
    }

    // 4) Send the message (MailChannels optional)
    let sent = false;
    let delivery = null;
    try {
      if (env.MAIL_TO && env.MAIL_FROM) {
        delivery = await sendMailViaMailChannels({ name, email, message, origin }, env);
        sent = delivery?.ok === true;
      }
    } catch (err) {
      // fall through; we'll still return ok if verification passed, unless you want strict failure
      delivery = { ok: false, error: err.message };
    }

    // 5) Build response
    return json({
      ok: true,
      sent,
      delivery,
      echo: { name, email, messageLength: message.length },
    }, 200, cors);
  }
};

/** ---------- Utilities ---------- */

function makeCorsHeaders(origin, env) {
  const allow = new Set(
    (env.ALLOW_ORIGINS || "https://www.humstudios.com,https://humstudios.github.io")
      .split(",").map(s => s.trim()).filter(Boolean)
  );
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
  if (allow.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

async function parsePayload(request) {
  const ctype = request.headers.get("Content-Type") || "";
  if (ctype.includes("application/json")) {
    return await request.json();
  }
  if (ctype.includes("multipart/form-data") || ctype.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const obj = {};
    for (const [k, v] of form.entries()) {
      obj[k] = typeof v === "string" ? v : (v?.name || "");
    }
    return obj;
  }
  // Default: try JSON then text fallback
  try { return await request.json(); } catch {}
  const text = await request.text();
  return { raw: text };
}

function getTurnstileToken(payload) {
  return (
    payload["cf-turnstile-response"] ||
    payload["turnstile_token"] ||
    payload["turnstileToken"] ||
    payload["token"] ||
    ""
  ).toString().trim();
}

async function verifyTurnstile(token, request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET || "");
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  if (!resp.ok) throw new Error("Turnstile verify HTTP " + resp.status);
  return await resp.json();
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", ...headers }
  });
}

async function sendMailViaMailChannels({ name, email, message, origin }, env) {
  const subject = `[Hum Studios] Contact from ${name || email}`;
  const content = [
    `From: ${name || "(no name)"} <${email}>`,
    `Origin: ${origin || "unknown"}`,
    "",
    message
  ].join("\n");

  const body = {
    personalizations: [{
      to: [{ email: env.MAIL_TO }],
    }],
    from: { email: env.MAIL_FROM, name: "Hum Studios Contact" },
    subject,
    content: [{ type: "text/plain", value: content }],
    reply_to: [{ email, name: name || email }]
  };

  const r = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const ok = r.ok;
  let data = null;
  try { data = await r.json(); } catch {}
  return { ok, status: r.status, data };
}
