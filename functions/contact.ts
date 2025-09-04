export interface Env {
  TURNSTILE_SECRET: string;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "Allow": "POST" },
    });;
  }

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const message = String(form.get("message") || "").trim();
  const token = String(form.get("cf-turnstile-response") || "");

  if (!name || !email || !message) {
      return new Response(JSON.stringify({ ok: false, error: "Missing fields." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
      })

  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "Missing Turnstile token." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify with Cloudflare Turnstile
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET || "",
      response: token,
      remoteip: request.headers.get("CF-Connecting-IP") || "",
    }),
  });

  const verify = await verifyRes.json().catch(() => ({} as any));
  if (!verify.success) {
    return new Response(JSON.stringify({ ok: false, error: "Turnstile verification failed." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // TODO: send the message somewhere (email, webhook, etc.). For now, just log.
  console.log("Contact form:", { name, email, message });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
