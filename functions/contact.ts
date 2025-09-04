// file: functions/api/contact.ts
export interface Env { TURNSTILE_SECRET: string }

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  // Only allow POST
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { "Allow": "POST" } });
  }

  // Parse form
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

  // Verify Turnstile token
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET || "",
      response: token,
      remoteip: request.headers.get("CF-Connecting-IP") || ""
    })
  });

  const verify: any = await verifyRes.json().catch(() => ({}));
  if (!verify.success) {
    return json({ ok: false, error: "Turnstile verification failed." }, 400);
  }

  // TODO: deliver the message (email/webhook). For now, log it.
  console.log("Contact form:", { name, email, message });

  return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
