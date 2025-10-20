// Hum Studios — Cloudflare Pages Advanced Mode Worker (single-hop + redirect-catch)
//
// Canonicalization in one 301 where possible. Serve clean URLs while backing onto .html files.
// Also catch CF static 308 redirects and serve the .html directly to avoid extra hops.

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

    // Immediate 410s for phantom URLs
    const goneSet = new Set(["/illustration.html", "/animation.html"]);
    if (goneSet.has(url.pathname)) return new Response("Gone", { status: 410 });

    // Normalize doubled slashes
    const normalizedPath = url.pathname.replace(/\/{2,}/g, "/");
    if (normalizedPath !== url.pathname) { url.pathname = normalizedPath; changed = true; }

    // Canonical host + HTTPS
    const CANONICAL_HOST = "www.humstudios.com";
    if (url.hostname !== CANONICAL_HOST) { url.hostname = CANONICAL_HOST; changed = true; }
    if (url.protocol !== "https:") { url.protocol = "https:"; changed = true; }

    // Legacy query patterns → home
    if (url.searchParams.has("cat")) { url.pathname = "/"; url.search = ""; changed = true; }

    // Legacy /work paths → home
    if (url.pathname === "/work" || url.pathname.startsWith("/work/")) { url.pathname = "/"; url.search = ""; changed = true; }

    // Index normalization
    if (url.pathname === "/index" || url.pathname === "/index.html") { url.pathname = "/"; url.search = ""; changed = true; }

    // .html → directory style
    if (url.pathname.endsWith(".html")) { url.pathname = url.pathname.replace(/\.html$/i, "/"); url.search = ""; changed = true; }

    // Ensure trailing slash for route-like paths (not files), except root
    if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
      url.pathname = url.pathname + "/"; changed = true;
    }

    // If anything changed (and we're on apex-to-www path aside), send one redirect
    if (changed && url.toString() !== incoming.toString()) {
      return redirect301(url);
    }

    // Serve asset. If CF tries to 3xx us (like /about/ → /about), intercept and try .html directly.
    let response = await env.ASSETS.fetch(new Request(url.toString(), request));

    // Intercept CF static redirects that would create a second hop
    if ((response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308)) {
      const loc = response.headers.get("Location") || "";
      try {
        const locURL = new URL(loc, url.toString());
        const removingSlash = url.pathname.endsWith("/") && (locURL.pathname === url.pathname.slice(0, -1));
        const toHtml = locURL.pathname.toLowerCase().endsWith(".html");
        const sameHost = locURL.host === url.host;

        if (sameHost && (removingSlash || toHtml)) {
          // Try fetching .html directly behind the scenes
          const tryHtml = new URL(url.toString());
          tryHtml.pathname = (url.pathname.endsWith("/"))
            ? url.pathname.slice(0, -1) + ".html"
            : url.pathname + ".html";
          const htmlRes = await env.ASSETS.fetch(new Request(tryHtml.toString(), request));
          if (htmlRes.ok) return htmlRes;
        }
      } catch { /* ignore parse errors and fall through */ }
      // Otherwise, return CF's redirect
      return response;
    }

    // Fallback: if 404 on /path/, try /path.html
    if (response.status === 404 && url.pathname.endsWith("/")) {
      const tryHtml = new URL(url.toString());
      tryHtml.pathname = url.pathname.slice(0, -1) + ".html";
      const htmlRes = await env.ASSETS.fetch(new Request(tryHtml.toString(), request));
      if (htmlRes.ok) return htmlRes;
    }

    return response;
  }
};
