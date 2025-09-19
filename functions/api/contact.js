// Cloudflare Pages Function (JavaScript): POST /api/contact
// - Accepts multipart/form-data and application/json
// - Verifies Cloudflare Turnstile (env: TURNSTILE_SECRET)
// - Sends mail via Resend (env: RESEND_API_KEY, RESEND_FROM, RESEND_TO, optional RESEND_SUBJECT_PREFIX)
// - Emits diagnostic logs with CONTACT_STAGE markers (minimal PII)
//
// Environment variables (Cloudflare Pages → Settings → Environment variables → Production):
//   TURNSTILE_SECRET
//   RESEND_API_KEY
//   RESEND_FROM           e.g., "Hum Studios <hello@humstudios.com>"
//   RESEND_TO             e.g., "hello@humstudios.com, ops@humstudios.com"
//   RESEND_SUBJECT_PREFIX (optional)
//
// Notes:
// - We intentionally pick the **last non-empty** Turnstile token in case multiple widgets post values.
// - Includes a simple "website" honeypot: if present and non-empty, we pretend success without sending.
// - Keep responses JSON; your frontend displays server codes on error.

export async function onRequestPost(context) {
  const { request, env } = context;
  const stage = (s, extra) => console.log("CONTACT_STAGE", s, extra || {});

  try {
    stage("start", { contentType: request.headers.get("content-type") || "" });

    const contentType = (request.headers.get("content-type") || "").toLowerCase();

    // Parse input
    let name = "", email = "", message = "", turnstileToken = "", website = "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      stage("parsed_json");
      name = (body.name || "").toString().trim();
      email = (body.email || "").toString().trim();
      message = (body.message || "").toString();
      website = (body.website || "").toString().trim();
      const t = flatArray([body.turnstileToken, body["cf-turnstile-response"], body["g-recaptcha-response"]]);
      turnstileToken = lastNonEmpty(t);
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      stage("parsed_form", { keys: Array.from(form.keys()) });
      name = String(form.get("name") || "").trim();
      email = String(form.get("email") || "").trim();
      message = String(form.get("message") || "");
      website = String(form.get("website") || "").trim();
      const tokens = formAll(form, "cf-turnstile-response")
        .concat(formAll(form, "turnstileToken"))
        .concat(formAll(form, "g-recaptcha-response"));
      turnstileToken = lastNonEmpty(tokens);
    } else {
      stage("unsupported_content_type");
      return jerr("UNSUPPORTED_CONTENT_TYPE", 415, "Unsupported content type");
    }

    // Honeypot — silently accept and drop obvious bots
    if (website) {
      stage("honeypot_trip");
      return json({ ok: true, id: null });
    }

    // Basic validation
    if (!name || !email || !message) {
      stage("validation_fail", { name: !!name, email: !!email, message: !!message });
      return jerr("MISSING_FIELDS", 400, "Missing name, email, or message");
    }
    if (!isValidEmail(email)) {
      stage("validation_fail_email", { email });
      return jerr("INVALID_EMAIL", 400, "Invalid email address");
    }
    if (!turnstileToken) {
      stage("missing_turnstile");
      return jerr("MISSING_TURNSTILE", 400, "Missing Turnstile token");
    }

    
    // Additional validation
    if (name.length > 200) {
      stage("validation_fail_name_len", { len: name.length });
      return jerr("NAME_TOO_LONG", 400, "Name is too long");
    }
    if (email.length > 254) {
      stage("validation_fail_email_len", { len: email.length });
      return jerr("EMAIL_TOO_LONG", 400, "Email is too long");
    }
    if (/[\x00-\x1F\x7F]/.test(name)) {
      stage("validation_fail_name_ctrl");
      return jerr("NAME_INVALID_CHARS", 400, "Invalid characters in name");
    }
    if (message.length > 5000) {
      stage("validation_fail_msg_len", { len: message.length });
      return jerr("MESSAGE_TOO_LONG", 400, "Message is too long");
    }
// Config presence log (booleans only)
    stage("config_presence", {
      hasTurnstileSecret: !!env.TURNSTILE_SECRET,
      hasResendApiKey: !!env.RESEND_API_KEY,
      hasResendFrom: !!env.RESEND_FROM,
      hasResendTo: !!env.RESEND_TO,
    });

    // Config check
    if (!env.TURNSTILE_SECRET) return jerr("CONFIG_TURNSTILE_SECRET", 500, "TURNSTILE_SECRET missing");
    if (!env.RESEND_API_KEY)   return jerr("CONFIG_RESEND_API_KEY", 500, "RESEND_API_KEY missing");
    if (!env.RESEND_FROM)      return jerr("CONFIG_RESEND_FROM", 500, "RESEND_FROM missing");
    if (!env.RESEND_TO)        return jerr("CONFIG_RESEND_TO", 500, "RESEND_TO missing");

    // Verify Turnstile
    stage("verify_turnstile_begin");
    const verifyOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, request);
    stage("verify_turnstile_end", verifyOk);
    if (!verifyOk.ok) {
      return jerr("TURNSTILE_FAIL", 400, "Turnstile verification failed", verifyOk.details || null);
    }

    // Compose email
    const prefix = (env.RESEND_SUBJECT_PREFIX || "").trim();
    const subject = `${prefix ? `[${prefix}] ` : ""}New contact from ${name}`.slice(0, 200);
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
    stage("resend_begin");
    const resendRes = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
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
    stage("resend_end", { status: resendRes.status, ok: resendRes.ok, id: resendData && resendData.id });

    if (!resendRes.ok) {
      return jerr("RESEND_API_ERROR", 502, "Resend API error", resendData || null);
    }

    // Minimal, privacy-conscious log
    const maskedEmail = maskEmail(email);
    console.log("CONTACT_SENT", { name, email: maskedEmail, len: message.length });

    return json({ ok: true, id: resendData && resendData.id || null });
  } catch (err) {
    console.error("CONTACT_ERROR", (err && err.stack) || String(err));
    return jerr("SERVER_ERROR", 500, "Server error");
  }
}


// Timed fetch helper
async function fetchWithTimeout(url, opts = {}, ms = 7000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}
// ---------- helpers ----------

function flatArray(x) {
  const arr = Array.isArray(x) ? x : [x];
  return arr.filter(v => v !== undefined && v !== null).map(v => String(v));
}

function lastNonEmpty(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = (arr[i] || "").trim();
    if (v) return v;
  }
  return "";
}

function formAll(form, key) {
  const vals = form.getAll(key);
  return vals.map(v => String(v || ""));
}


async function verifyTurnstile(token, secret, request) {
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  formData.append("remoteip", request.headers.get("CF-Connecting-IP") || "");

  const res = await fetchWithTimeout("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: formData }, 7000);
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, details: { error: "no-data" } };

  // Hardened checks
  const allowedHost = "www.humstudios.com";
  const host = String(data.hostname || "");
  const hostOk = host === allowedHost;
  const actionOk = data.action === "contact";
  const ts = Date.parse(data.challenge_ts || 0);
  const fresh = Number.isFinite(ts) && (Date.now() - ts) < 3 * 60 * 1000; // 3 minutes

  return {
    ok: Boolean(data.success && hostOk && actionOk && fresh),
    details: data
  };
}


function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function splitEmails(v) {
  return (v || "").split(",").map(s => s.trim()).filter(Boolean);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function maskEmail(e) {
  return String(e).replace(/(.{2}).+(@.+)/, "$1***$2");
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    },
  });
}

function jerr(code, status, error, details) {
  return json({ ok: false, code, error, details: details || null }, status);
}
