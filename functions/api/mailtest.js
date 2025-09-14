export async function onRequest({ env }) {
  const payload = {
    personalizations: [{ to: [{ email: env.CONTACT_TO }] }],
    from: { email: env.CONTACT_FROM, name: "MailTest" },
    subject: "MailChannels test from Pages",
    content: [{ type: "text/plain", value: "Hello from Cloudflare Pages." }]
  };

  const r = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const t = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: t.slice(0, 300) }), {
    headers: { "content-type": "application/json" }
  });
}
