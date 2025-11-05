// Hum Studios — Cloudflare Pages Worker (v3): no-loop trailing slashes
// Public policy: **trailing slashes** (/about/). Files on disk: flat **.html** (about.html).
// Fix for HEAD-based checks (curl -I, Googlebot HEAD): internally rewrite *both* GET and HEAD
// trailing-slash navigations to the corresponding .html so the asset layer never 308s back.
//
// External redirects (canonicalization):
//  - Force HTTPS + www
//  - /index.html  →  /
//  - *.html       →  strip extension and add trailing slash (e.g. /about.html → /about/)
//  - Add trailing slash on non-root, non-file paths (e.g. /about → /about/)
//
// Internal rewrite (no external redirect):
//  - /            →  /index.html
//  - /leaf/       →  /leaf.html
//
// Legacy: ?cat=* → /, /work/* → /, specific phantom 410s.

function redirect301(url) {
  return Response.redirect(url.toString(), 301);
}

function hasFileExtension(pathname) {
  const last = (pathname.split("/").pop() || "");
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

    // D) Index normalization (external redirect only for explicit index paths)
    if (url.pathname === "/index" || url.pathname === "/index.html") {
      url.pathname = "/";
      url.search = "";
      changed = true;
    }

    // E) .html → strip and enforce trailing slash (external redirect)
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/i, "/");
      if (url.pathname === "") url.pathname = "/";
      url.search = "";
      changed = true;
    }

    // F) Add trailing slash for non-root, non-file paths (external redirect)
    if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
      url.pathname = url.pathname + "/";
      changed = true;
    }

    // If canonical URL differs, perform ONE external redirect
    if (changed && url.toString() !== incoming.toString()) {
      return redirect301(url);
    }

    // G) INTERNAL REWRITE to flat files for asset fetch (NO external redirect).
    // Apply for **GET and HEAD** HTML-like navigations so curl -I / Googlebot HEAD don't loop.
    const assetURL = new URL(url.toString());
    if (assetURL.pathname === "/") {
      assetURL.pathname = "/index.html";
    } else if (assetURL.pathname.endsWith("/") && !hasFileExtension(assetURL.pathname)) {
      assetURL.pathname = assetURL.pathname.slice(0, -1) + ".html";
    }

    // Fetch using internal mapping so Pages serves the correct file without bouncing
    return env.ASSETS.fetch(new Request(assetURL.toString(), request));
  }
};
