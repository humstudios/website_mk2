// Hum Studios — Cloudflare Pages Worker (v4): trailing slashes, no-loop, redirect-catch hotfix
// Public policy: **trailing slashes** (/about/). Files: flat **.html** (about.html).
// Some Pages configs (Clean URLs, Trailing slash=remove, or stray _redirects) can force 308s back to no‑slash.
// This Worker prevents loops by: (1) canonicalizing once; (2) internally rewriting to .html; and
// (3) catching asset-layer 30x responses that try to bounce to no-slash, then refetching the intended .html directly.
//
// Safe to run even if Pages settings are fixed; catch only triggers when needed.
//
// External redirects (one hop max):
//  - Force HTTPS + www
//  - /index.html → /
//  - *.html      → strip + add slash  (e.g. /about.html → /about/)
//  - /leaf       → /leaf/
//
// Internal rewrite (no redirect):
//  - /           → /index.html
//  - /leaf/      → /leaf.html
//
// Hotfix redirect catch:
//  - If ASSETS returns 301/302/307/308 for /leaf/ → /leaf (or similar), refetch /leaf.html and return that 200.
//  - This neutralizes Clean URLs / trailing-slash conflicts at the asset layer.

function redirect301(url) {
  return Response.redirect(url.toString(), 301);
}

function hasFileExtension(pathname) {
  const last = (pathname.split("/").pop() || "");
  return last.includes(".");
}

// Parse possibly relative Location to an absolute URL based on a base
function resolveLocation(loc, base) {
  try { return new URL(loc, base); } catch (e) { return null; }
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const url = new URL(incoming.toString());
    let changed = false;

    // 0) 410s for phantom URLs
    const goneSet = new Set(["/illustration.html", "/animation.html"]);
    if (goneSet.has(url.pathname)) return new Response("Gone", { status: 410 });

    // A) Collapse duplicate slashes
    const normalizedPath = url.pathname.replace(/\/{2,}/g, "/");
    if (normalizedPath !== url.pathname) { url.pathname = normalizedPath; changed = true; }

    // B) Canonical host + HTTPS
    const CANONICAL_HOST = "www.humstudios.com";
    if (url.hostname !== CANONICAL_HOST) { url.hostname = CANONICAL_HOST; changed = true; }
    if (url.protocol !== "https:") { url.protocol = "https:"; changed = true; }

    // C) Legacy cleanups
    if (url.searchParams.has("cat")) { url.pathname = "/"; url.search = ""; changed = true; }
    if (url.pathname === "/work" || url.pathname.startsWith("/work/")) { url.pathname = "/"; url.search = ""; changed = true; }

    // D) Index normalization
    if (url.pathname === "/index" || url.pathname === "/index.html") { url.pathname = "/"; url.search = ""; changed = true; }

    // E) .html → strip + trailing slash
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/i, "/");
      if (url.pathname === "") url.pathname = "/";
      url.search = "";
      changed = true;
    }

    // F) Add trailing slash on leaf paths
    if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
      url.pathname = url.pathname + "/";
      changed = true;
    }

    // Emit one external redirect if canonical changed
    if (changed && url.toString() !== incoming.toString()) return redirect301(url);

    // G) Internal mapping to flat files
    const assetURL = new URL(url.toString());
    if (assetURL.pathname === "/") {
      assetURL.pathname = "/index.html";
    } else if (assetURL.pathname.endsWith("/") && !hasFileExtension(assetURL.pathname)) {
      assetURL.pathname = assetURL.pathname.slice(0, -1) + ".html";
    }

    // First attempt: fetch intended asset
    let res = await env.ASSETS.fetch(new Request(assetURL.toString(), request));

    // Hotfix: if asset layer tries to redirect back to a no-slash path, neutralize
    if ([301,302,307,308].includes(res.status)) {
      const loc = res.headers.get("Location");
      const target = resolveLocation(loc, incoming);
      if (target) {
        const path = target.pathname;
        // If redirect target is simply the no-slash variant or .html-less, force-fetch the .html file
        const isNoSlashBounce = (path === url.pathname.replace(/\/$/, ""));
        const isHtmlLessBounce = (!path.endsWith("/") && !hasFileExtension(path));
        if (isNoSlashBounce || isHtmlLessBounce) {
          // Refetch as .html and return
          const retry = new URL(url.toString());
          if (retry.pathname.endsWith("/")) retry.pathname = retry.pathname.slice(0, -1) + ".html";
          else if (!hasFileExtension(retry.pathname)) retry.pathname = retry.pathname + ".html";
          res = await env.ASSETS.fetch(new Request(retry.toString(), request));
        }
      }
    }

    return res;
  }
};
