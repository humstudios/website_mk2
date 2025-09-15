// Cloudflare Pages Functions catch-all to serve a 503 maintenance page (JavaScript version).
// Put this file at: functions/[[path]].js   (Production branch only)
//
// It returns 503 + Retry-After for everything EXCEPT paths in the allowlist below.
// Edit ALLOW_EXACT / ALLOW_PREFIXES to suit your needs.

const ALLOW_PREFIXES = [
  "/api/",          // keep API routes
  "/assets/",       // keep static assets if you want
  "/favicon",       // favicons/apple-touch icons
  "/robots.txt",    // robots
];

const ALLOW_EXACT = new Set([
  "/contact",       // keep contact page
  "/contact/",
  // "/" is intentionally not allowed here so the homepage shows maintenance.
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const p = url.pathname;

  // Allow whitelisted paths to pass through
  if (ALLOW_EXACT.has(p) || ALLOW_PREFIXES.some(pre => p.startsWith(pre))) {
    return context.next();
  }

  // Serve a minimal inline maintenance page
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Maintenance</title><meta name="robots" content="noindex,nofollow"></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#f7f9fc;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <main style="max-width:720px;width:min(720px,92vw);background:#fff;border-radius:20px;box-shadow:0 8px 30px rgba(0,0,0,.08);padding:clamp(1rem,3.5vw,2rem)">
    <h1 style="margin:0 0 .5rem;font-size:clamp(1.4rem,3.2vw,2rem)">We’ll be right back</h1>
    <p style="margin:.5rem 0;line-height:1.6;color:#374151">The site is in maintenance while we deploy a new build.</p>
    <p style="margin:.5rem 0;line-height:1.6;color:#6b7280">You can still <a href="/contact">contact us</a>.</p>
  </main>
</body></html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "3600",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
