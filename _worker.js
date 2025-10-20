// Hum Studios — Cloudflare Pages Advanced Mode Worker (single-hop + direct .html serve)
//
// Strategy:
//  - Canonicalize in one 301 (host, https, .html→slash, index→/, legacy paths/queries).
//  - For requests that already end with a slash (e.g., /about/, /privacy/), try serving the
//    backing .html *before* calling ASSETS, to avoid CF's internal 308.
//  - Serve 410 for phantom URLs immediately.

function redirect301(url) {
  return Response.redirect(url.toString(), 301);
}

function hasFileExtension(pathname) {
  const last = pathname.split("/").pop() || "";
  return last.includes(".");
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const url = new URL(incoming.toString());
    let changed = false;

    // 0) Immediate 410s for phantom URLs
    const goneSet = new Set(["/illustration.html", "/animation.html"]);
    if (goneSet.has(url.pathname)) {
      return new Response("Gone", { status: 410 });
    }

    // A) Normalize double slashes
    const normalizedPath = url.pathname.replace(/\/{2,}/g, "/");
    if (normalizedPath !== url.pathname) { url.pathname = normalizedPath; changed = true; }

    // B) Canonical host + HTTPS
    const CANONICAL_HOST = "www.humstudios.com";
    if (url.hostname !== CANONICAL_HOST) { url.hostname = CANONICAL_HOST; changed = true; }
    if (url.protocol !== "https:") { url.protocol = "https:"; changed = true; }

    // C) Legacy query/url patterns → home
    if (url.searchParams.has("cat")) { url.pathname = "/"; url.search = ""; changed = true; }
    if (url.pathname === "/work" || url.pathname.startsWith("/work/")) { url.pathname = "/"; url.search = ""; changed = true; }

    // D) Index normalization
    if (url.pathname === "/index" || url.pathname === "/index.html") { url.pathname = "/"; url.search = ""; changed = true; }

    // E) .html → directory style
    if (url.pathname.endsWith(".html")) { url.pathname = url.pathname.replace(/\.html$/i, "/"); url.search = ""; changed = true; }

    // F) Ensure trailing slash for route-like paths (not files), except root
    if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
      url.pathname = url.pathname + "/"; changed = true;
    }

    // If anything changed, emit one redirect to the final canonical URL
    if (changed && url.toString() !== incoming.toString()) {
      return redirect301(url);
    }

    // G) Serve trailing-slash routes by backing .html directly to avoid CF 308
    if (url.pathname.endsWith("/") && url.pathname !== "/") {
      const tryHtml = new URL(url.toString());
      tryHtml.pathname = url.pathname.slice(0, -1) + ".html";
      const htmlRes = await env.ASSETS.fetch(new Request(tryHtml.toString(), request));
      if (htmlRes.ok) {
        // Add canonical link header if desired (optional)
        return htmlRes;
      }
      // If .html doesn't exist, fall through to ASSETS for normal handling
    }

    // H) Default: hand off to ASSETS
    let response = await env.ASSETS.fetch(new Request(url.toString(), request));

    // I) Fallback: if 404 on /path/, try /path.html (safety net)
    if (response.status === 404 && url.pathname.endsWith("/")) {
      const tryHtml = new URL(url.toString());
      tryHtml.pathname = url.pathname.slice(0, -1) + ".html";
      const htmlRes = await env.ASSETS.fetch(new Request(tryHtml.toString(), request));
      if (htmlRes.ok) return htmlRes;
    }

    return response;
  }
};
