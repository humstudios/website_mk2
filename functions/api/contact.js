// file: functions/api/contact.js
// Notes:
// - Keeps your onRequest handler (POST only).
// - Adds honeypot check (`website`), Turnstile `action` and `hostname` checks.
// - Removes PII console logging.
// - Returns structured JSON errors with no-store caching.

export const onRequest = async ({ request, env }) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { "Allow": "POST" } });
  }

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const message = String(form.get("message") || "").trim();
  const token = String(form.get("cf-turnstile-response") || "");
  const website = String(form.get("website") || "").trim(); // honeypot

  if (website) {
    return json({ ok: false, error: "bot-detected" }, 400);
  }
  if (!name || !email || !message) {
    return json({ ok: false, error: "missing-fields" }, 422);
  }
  if (!token) {
    return json({ ok: false, error: "missing-token" }, 400);
  }

  // Turnstile verify
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET || "",
      response: token,
      remoteip: ip
    })
  });
  const verify = await verifyRes.json().catch(() => ({}));

  // Extra hardening: ensure the widget action/hostname match expectations
  const expectedAction = "contact"; // must match data-action on your widget
  const requestHost = new URL(request.url).hostname;
  const actionOk = !verify.action || verify.action === expectedAction;
  const hostOk = !verify.hostname || verify.hostname === requestHost || verify.hostname.endsWith(".pages.dev");

  if (!verify.success || !actionOk || !hostOk) {
    return json({
      ok: false,
      error: "turnstile-failed",
      data: {
        success: verify.success ?? false,
        action: verify.action ?? null,
        hostname: verify.hostname ?? null,
        "error-codes": verify["error-codes"] ?? null
      }
    }, 400);
  }

  // TODO: send email or queue a job here (avoid logging PII)
  return json({ ok: true });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
