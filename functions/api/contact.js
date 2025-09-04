// file: functions/api/contact.js
export const onRequest = async ({ request, env }) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { "Allow": "POST" } });
  }

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const message = String(form.get("message") || "").trim();
  const token = String(form.get("cf-turnstile-response") || "");

  if (!name || !email || !message) {
    return json({ ok: false, error: "Missing fields." }, 400);
  }
  if (!token) {
    return json({ ok: false, error: "Missing Turnstile token." }, 400);
  }

  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET || "",
      response: token,
      remoteip: request.headers.get("CF-Connecting-IP") || ""
    })
  });
  const verify = await verifyRes.json().catch(() => ({}));
  if (!verify.success) {
    return json({ ok: false, error: "Turnstile verification failed." }, 400);
  }

  console.log("Contact form:", { name, email, message });
  return json({ ok: true });
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
