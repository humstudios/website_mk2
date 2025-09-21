// contact-worker.redirect.js
// JSON for AJAX; 303 redirect back to the contact page for classic form POSTs (Accept: text/html)
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = makeCorsHeaders(origin, env);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Not Found" }, 404, cors);

    let payload;
    try { payload = await parsePayload(request); }
    catch (e) { return json({ error: "Invalid request body", detail: e.message }, 400, cors); }

    const name = (payload.name || "").toString().trim();
    const email = (payload.email || "").toString().trim();
    const message = (payload.message || "").toString().trim();
    const token = getTurnstileToken(payload);
    if (!email || !message) return json({ error: "Missing required fields: email, message" }, 400, cors);
    if (!token) return json({ error: "Missing Turnstile token" }, 400, cors);

    try {
      const verify = await verifyTurnstile(token, request, env);
      if (!verify.success) return json({ error: "Turnstile verification failed", detail: verify["error-codes"] || null }, 403, cors);
      if (env.TURNSTILE_ENFORCE_HOSTNAME === "1") {
        const expected = new Set((env.TURNSTILE_ALLOWED_HOSTNAMES || "").split(",").map(s => s.trim()).filter(Boolean));
        if (expected.size && !expected.has(verify.hostname)) return json({ error: "Unexpected hostname", hostname: verify.hostname }, 403, cors);
      }
    } catch (err) {
      return json({ error: "Turnstile verification error", detail: err.message }, 502, cors);
    }

    // OPTIONAL: send via MailChannels if configured
    let sent = false;
    try {
      if (env.MAIL_TO && env.MAIL_FROM) {
        const r = await sendMailViaMailChannels({ name, email, message, origin }, env);
        sent = r?.ok === true;
      }
    } catch {}

    // If the client expects HTML (classic form POST), redirect back with a success flag.
    const wantsHTML = /\btext\/html\b/.test(request.headers.get("Accept") || "");
    if (wantsHTML) {
      const back =
        (env.THANK_YOU_URL || "").trim() ||
        (origin ? origin.replace(/\/$/, "") + "/contact.html?sent=1#contact" : "/contact.html?sent=1#contact");
      return Response.redirect(back, 303);
    }

    return json({ ok: true, sent }, 200, cors);
  }
};

function makeCorsHeaders(origin, env) {
  const allow = new Set((env.ALLOW_ORIGINS || "https://www.humstudios.com,https://humstudios.github.io").split(",").map(s => s.trim()).filter(Boolean));
  const h = { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };
  if (allow.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

async function parsePayload(request) {
  const ctype = request.headers.get("Content-Type") || "";
  if (ctype.includes("application/json")) return await request.json();
  if (ctype.includes("multipart/form-data") ) {
    const form = await request.formData();
    const obj = {}; for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : (v?.name || "");
    return obj;
  }
  if (ctype.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const obj = {}; for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : (v?.name || "");
    return obj;
  }
  try { return await request.json(); } catch {}
  const text = await request.text(); return { raw: text };
}

function getTurnstileToken(p) { return (p["cf-turnstile-response"] || p["turnstile_token"] || p["turnstileToken"] || p["token"] || "").toString().trim(); }

async function verifyTurnstile(token, request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const form = new FormData(); form.append("secret", env.TURNSTILE_SECRET || ""); form.append("response", token); if (ip) form.append("remoteip", ip);
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  if (!resp.ok) throw new Error("Turnstile verify HTTP " + resp.status); return await resp.json();
}

function json(obj, status = 200, headers = {}) { return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json; charset=UTF-8", ...headers } }); }

async function sendMailViaMailChannels({ name, email, message, origin }, env) {
  const subject = `[Hum Studios] Contact from ${name || email}`;
  const content = [`From: ${name || "(no name)"} <${email}>`, `Origin: ${origin || "unknown"}`, "", message].join("\n");
  const body = { personalizations: [{ to: [{ email: env.MAIL_TO }] }], from: { email: env.MAIL_FROM, name: "Hum Studios Contact" }, subject, content: [{ type: "text/plain", value: content }], reply_to: [{ email, name: name || email }] };
  const r = await fetch("https://api.mailchannels.net/tx/v1/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status };
}
