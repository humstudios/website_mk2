// functions/api/contact.js
// Cloudflare Pages Function — Contact endpoint
// - Accepts JSON, multipart/form-data, or x-www-form-urlencoded
// - Verifies Cloudflare Turnstile
// - Sends email via Resend (if configured)
// - On classic HTML form posts, 303-redirects back to the contact page so the UI shows inline success
//
// Required env vars (Pages → Settings → Environment variables):
//   TURNSTILE_SECRET
//   TURNSTILE_ALLOWED_HOSTNAMES="www.humstudios.com,humstudios.github.io"   (preview) / "www.humstudios.com" (prod)
//   THANK_YOU_URL="https://www.humstudios.com/contact.html?sent=1#contact"  (or GH Pages URL while testing)
// Email (optional via Resend):
//   RESEND_API_KEY, RESEND_FROM, RESEND_TO, (optional) RESEND_SUBJECT_PREFIX

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
  const honeypot = s(body.website || body.hp || ""); // if you use a honeypot field
  const turnstileToken =
    s(body["cf-turnstile-response"]) ||
    s(body.turnstileToken) ||
    s(body.turnstile_token) ||
    s(body.token);

  // Basic validation
  if (honeypot) return jerr(400, "Bot suspected");
  if (!email || !message) return jerr(400, "Missing required fields: email, message");
  if (!turnstileToken) return jerr(400, "Missing Turnstile token");

  // 3) Verify Turnstile (now with env + hostname allowlist)
  const verifyOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, request, env);
  if (!verifyOk.ok) {
    return jerr(403, "Turnstile verification failed", verifyOk.details || null);
  }

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
        origin: request.headers.get("Origin") || ""
      });
      sent = !!res.ok;
      mailId = res.id || null;
      if (!res.ok) mailErr = res.error || ("HTTP " + res.status);
    } catch (e) {
      mailErr = e?.message || "Email send failed";
    }
  }

  // 5) Classic form POST? Redirect back so the page shows the inline “Thanks”
  const accept = (request.headers.get("accept") || request.headers.get("Accept") || "").toLowerCase();
  const wantsHTML = /\btext\/html\b/.test(accept);
  if (wantsHTML) {
    const back = (env.THANK_YOU_URL || "https://www.humstudios.com/contact.html?sent=1#contact").trim();
    return Response.redirect(back, 303);
  }

  // 6) Otherwise: JSON (useful for AJAX/tools)
  return jok({
    ok: true,
    id: mailId,
    sent,
  });
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
  // Try JSON, then text fallback
  try { return await request.json(); } catch {}
  const text = await request.text();
  return { raw: text };
}

async function verifyTurnstile(token, secret, request, env) {
  if (!secret) return { ok: false, details: { error: "Missing TURNSTILE_SECRET" } };

  // Build form for siteverify
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const fd = new FormData();
  fd.append("secret", secret);
  fd.append("response", token);
  if (ip) fd.append("remoteip", ip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: fd
  });
  if (!resp.ok) {
    return { ok: false, details: { error: "siteverify HTTP " + resp.status } };
  }
  const data = await resp.json();

  // Hardened checks (HOSTNAME + ACTION + FRESHNESS)
  const allowed = (env?.TURNSTILE_ALLOWED_HOSTNAMES || "www.humstudios.com")
    .split(",").map(x => x.trim()).filter(Boolean);

  const host = String(data.hostname || "");
  const hostOk = allowed.includes(host);

  const actionOk = String(data.action || "") === "contact";
  const ts = Date.parse(data.challenge_ts || 0);
  const fresh = Number.isFinite(ts) && (Date.now() - ts) < 3 * 60 * 1000; // 3 minutes

  return {
    ok: Boolean(data.success && hostOk && actionOk && fresh),
    details: data
  };
}

async function sendViaResend({ apiKey, from, to, subjectPrefix, name, email, message, origin }) {
  const subject = `${subjectPrefix ? subjectPrefix + " " : ""}Contact from ${name || email}`;
  const html = `
    <p><strong>From:</strong> ${escapeHtml(name || "(no name)")} &lt;${escapeHtml(email)}&gt;</p>
    <p><strong>Origin:</strong> ${escapeHtml(origin || "unknown")}</p>
    <pre style="white-space:pre-wrap">${escapeHtml(message)}</pre>
  `.trim();
  const payload = {
    from,
    to,
    subject,
    html,
    text: `From: ${name || "(no name)"} <${email}>\nOrigin: ${origin || "unknown"}\n\n${message}`
  };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
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

function jok(obj, headers = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function jerr(status, error, detail = null, headers = {}) {
  return new Response(JSON.stringify({ error, detail }, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}
