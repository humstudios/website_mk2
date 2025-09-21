// Cloudflare Pages Function — Contact endpoint
// Always redirects after successful POST so the page shows inline success.

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1) Parse input (JSON or form)
  let body;
  try {
    body = await parsePayload(request);
  } catch (err) {
    return jerr(400, "Invalid request body", err.message);
  }

  // 2) Collect fields
  const email = s(body.email);
  const name = s(body.name);
  const message = s(body.message);
  const honeypot = s(body.website || body.hp || ""); // optional honeypot
  const token =
    s(body["cf-turnstile-response"]) ||
    s(body.turnstileToken) ||
    s(body.turnstile_token) ||
    s(body.token);

  if (honeypot)        return jerr(400, "Bot suspected");
  if (!email || !message) return jerr(400, "Missing required fields: email, message");
  if (!token)          return jerr(400, "Missing Turnstile token");

  // 3) Turnstile verify (hostname allow-list via env)
  const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET, request, env);
  if (!ok.ok) return jerr(403, "Turnstile verification failed", ok.details || null);

  // 4) (Optional) send via Resend
  if (env.RESEND_API_KEY && env.RESEND_FROM && env.RESEND_TO) {
    try {
      await sendViaResend({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM,
        to: env.RESEND_TO,
        subjectPrefix: env.RESEND_SUBJECT_PREFIX || "",
        name, email, message,
        origin: request.headers.get("Origin") || ""
      });
    } catch (_) {
      // Ignore email errors for UX; you can log if you like
    }
  }

  // 5) ALWAYS redirect back (no JSON page)
  const back = (env.THANK_YOU_URL || "https://www.humstudios.com/contact.html?sent=1#contact").trim();
  return Response.redirect(back, 303);
}

/* ----------------- helpers ----------------- */

function s(v) { return (v == null) ? "" : String(v).trim(); }

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

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd });
  if (!resp.ok) return { ok: false, details: { error: "siteverify HTTP " + resp.status } };
  const data = await resp.json();

  // Hardened checks: hostname + action + freshness
  const allowed = (env?.TURNSTILE_ALLOWED_HOSTNAMES || "www.humstudios.com")
    .split(",").map(x => x.trim()).filter(Boolean);

  const host    = String(data.hostname || "");
  const hostOk  = allowed.includes(host);
  const actionOk= String(data.action || "") === "contact";
  const ts      = Date.parse(data.challenge_ts || 0);
  const fresh   = Number.isFinite(ts) && (Date.now() - ts) < 3 * 60 * 1000;

  return { ok: Boolean(data.success && hostOk && actionOk && fresh), details: data };
}

async function sendViaResend({ apiKey, from, to, subjectPrefix, name, email, message, origin }) {
  const subject = `${subjectPrefix ? subjectPrefix + " " : ""}Contact from ${name || email}`;
  const html = `
    <p><strong>From:</strong> ${escapeHtml(name || "(no name)")} &lt;${escapeHtml(email)}&gt;</p>
    <p><strong>Origin:</strong> ${escapeHtml(origin || "unknown")}</p>
    <pre style="white-space:pre-wrap">${escapeHtml(message)}</pre>
  `.trim();
  const payload = {
    from, to, subject, html,
    text: `From: ${name || "(no name)"} <${email}>\nOrigin: ${origin || "unknown"}\n\n${message}`
  };

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jerr(status, error, detail = null, headers = {}) {
  return new Response(JSON.stringify({ error, detail }, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}
