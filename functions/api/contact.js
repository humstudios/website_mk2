// functions/api/contact.js
// Cloudflare Pages Function — Contact endpoint
// - Accepts JSON, multipart/form-data, or x-www-form-urlencoded
// - Verifies Cloudflare Turnstile (hostname + action + freshness)
// - Sends email via Resend (if configured)
// - Returns JSON for AJAX submit (no reload), or 303 redirect for classic posts
// - CORS support for cross-origin testing from GitHub Pages

export async function onRequestOptions({ request, env }) {
  // CORS preflight
  const headers = makeCorsHeaders(request.headers.get("Origin") || "", env);
  return new Response(null, { headers });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin") || "";
  const cors = makeCorsHeaders(origin, env);

  // 1) Parse input
  let body;
  try {
    body = await parsePayload(request);
  } catch (err) {
    return jerr(400, "Invalid request body", err?.message, cors);
  }

  // 2) Collect fields
  const email = s(body.email);
  const name = s(body.name);
  const message = s(body.message);
  const honeypot = s(body.website || body.hp || ""); // optional honeypot field
  const token =
    s(body["cf-turnstile-response"]) ||
    s(body.turnstileToken) ||
    s(body.turnstile_token) ||
    s(body.token);

  if (honeypot) return jerr(400, "Bot suspected", null, cors);
  if (!email || !message) return jerr(400, "Missing required fields: email, message", null, cors);
  if (!token) return jerr(400, "Missing Turnstile token", null, cors);

  // 3) Verify Turnstile
  const t = await verifyTurnstile(token, env.TURNSTILE_SECRET, request, env);
  if (!t.ok) return jerr(403, "Turnstile verification failed", t.details || null, cors);

  // 4) Optional email via Resend
  let sent = false, mailId = null, mailErr = null;
  if (env.RESEND_API_KEY && env.RESEND_FROM && env.RESEND_TO) {
    try {
      const res = await sendViaResend({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM,
        to: env.RESEND_TO,
        subjectPrefix: env.RESEND_SUBJECT_PREFIX || "",
        name, email, message,
        origin
      });
      sent = !!res.ok;
      mailId = res.id || null;
      if (!res.ok) mailErr = res.error || ("HTTP " + res.status);
    } catch (e) {
      mailErr = e?.message || "Email send failed";
    }
  }

  // 5) Decide response: AJAX (JSON) vs classic (redirect)
  const accept = (request.headers.get("accept") || "").toLowerCase();
  const ct     = (request.headers.get("content-type") || "").toLowerCase();
  const xrw    = (request.headers.get("x-requested-with") || "").toLowerCase();
  const isJsonReq  = ct.includes("application/json") || accept.includes("application/json") || accept.includes("text/json");
  const isAjaxLike = (xrw === "xmlhttprequest") || isJsonReq;

  if (isAjaxLike) {
    // JSON path (no reload)
    return jok({ ok: true, id: mailId, sent, mailErr }, cors);
  }

  // Classic form path (reload back to page showing inline success)
  const back = (env.THANK_YOU_URL || "https://www.humstudios.com/contact.html?sent=1#contact").trim();
  return Response.redirect(back, 303);
}

/* ----------------- helpers ----------------- */

function s(v) { return (v == null) ? "" : String(v).trim(); }

function makeCorsHeaders(origin, env) {
  // ALLOW_ORIGINS example (testing): "https://humstudios.github.io,https://www.humstudios.com"
  const allow = (env.ALLOW_ORIGINS || "https://www.humstudios.com,https://humstudios.github.io")
    .split(",").map(x => x.trim()).filter(Boolean);
  const h = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
    "Vary": "Origin"
  };
  if (allow.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

async function parsePayload(request) {
  const ct = (request.headers.get("Content-Type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return await request.json();
  }
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const obj = {};
    for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : (v?.name || "");
    return obj;
  }
  try { return await request.json(); } catch {}
  const text = await request.text();
  return { raw: text };
}

async function verifyTurnstile(token, secret, request, env) {
  if (!secret) return { ok: false, details: { error: "Missing TURNSTILE_SECRET" } };

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const fd = new FormData();
  fd.append("secret", secret);
  fd.append("response", token);
  if (ip) fd.append("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: fd
  });
  if (!resp.ok) return { ok: false, details: { error: "siteverify HTTP " + resp.status } };
  const data = await resp.json();

  // Hardened checks: hostname + action + freshness
  const allowed = (env?.TURNSTILE_ALLOWED_HOSTNAMES || "www.humstudios.com")
    .split(",").map(x => x.trim()).filter(Boolean);

  const host     = String(data.hostname || "");
  const hostOk   = allowed.includes(host);
  const actionOk = String(data.action || "") === "contact";
  const ts       = Date.parse(data.challenge_ts || 0);
  const fresh    = Number.isFinite(ts) && (Date.now() - ts) < 3 * 60 * 1000; // 3 minutes

  return { ok: Boolean(data.success && hostOk && actionOk && fresh), details: data };
}

async function sendViaResend({ apiKey, from, to, subjectPrefix, name, email, message, origin }) {
  const subject = `${subjectPrefix ? subjectPrefix + " " : ""}Contact from ${name || email}`;
  const html = `
    <p><strong>From:</strong> ${escapeHtml(name || "(no name)")} &lt;${escapeHtml(email)}&gt;</p>
    <p><strong>Origin:</strong> ${escapeHtml(origin || "unknown")}</p>
    <pre style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</pre>
  `.trim();
  const payload = {
    from, to, subject, html,
    text: `From: ${name || "(no name)"} <${email}>\nOrigin: ${origin || "unknown"}\n\n${message}`
  };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let data = null;
  try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, id: data?.id, error: data?.message || null };
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jok(obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders }
  });
}

function jerr(status, error, detail = null, extraHeaders = {}) {
  return new Response(JSON.stringify({ error, detail }, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders }
  });
}
