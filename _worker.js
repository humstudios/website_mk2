// Hum Studios — Cloudflare Pages Worker (enforce trailing slashes + internal rewrite to .html)
//
// Goal: Keep public URLs with trailing slashes (e.g. /about/), but serve flat files like /about.html
// without creating redirect loops. We *redirect* to add the slash, then *internally rewrite* the
// asset fetch so Cloudflare serves the correct file while the browser URL remains pretty.
//
// Canonicalization:
//  - Force HTTPS + www
//  - /index.html → /
//  - Drop `.html` → trailing‑slash path (e.g., /about.html → /about/)
//  - Add trailing slash on non-root, non-file paths
//  - Legacy cleanup: ?cat=* and /work/* → /
//  - 410 for specific phantom URLs
//
// Serving behavior:
//  - If requesting a trailing‑slash path (e.g., /about/), *internally map* to /about.html for ASSETS.fetch
//    so Pages finds the file, but do NOT redirect. This prevents /about ↔ /about/ loops seen by crawlers.

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

    // E) .html → remove extension and enforce trailing slash
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/i, "/");
      if (url.pathname === "") url.pathname = "/"; // safety
      url.search = "";
      changed = true;
    }

    // F) Add trailing slash for non-root, non-file paths
    if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
      url.pathname = url.pathname + "/";
      changed = true;
    }

    // Emit a single redirect if the canonical URL differs
    if (changed && url.toString() !== incoming.toString()) {
      return redirect301(url);
    }

    // G) INTERNAL REWRITE for trailing‑slash paths to corresponding .html flat files
    // Example: /about/ → (internally) /about.html  (no redirect)
    let assetURL = new URL(url.toString());
    if (assetURL.pathname !== "/" && assetURL.pathname.endsWith("/") && !hasFileExtension(assetURL.pathname)) {
      assetURL.pathname = assetURL.pathname.slice(0, -1) + ".html";
    }

    // Serve asset (using the internally mapped URL if applied)
    return env.ASSETS.fetch(new Request(assetURL.toString(), request));
  }
};
