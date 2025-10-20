// Hum Studios — Cloudflare Pages Worker (canonical: no trailing slash for leaf pages)
//
// Rationale: Cloudflare Pages issues 308s from `/about/` → `/about` when backed by `about.html`.
// Fighting that adds complexity; instead, adopt the platform's preferred convention.
// Canonicalization:
//  - Force HTTPS + www
//  - Drop `.html` → bare path (e.g., /about)
//  - /index.html → /
//  - Remove trailing slash on non-root, non-file paths
//  - Legacy cleanup: ?cat=*, /work/* → /
//  - 410 for phantom URLs
//
// Note: Keep `_redirects` out of repo; this Worker owns routing.

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

    // E) .html → remove extension
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/i, "");
      if (url.pathname === "") url.pathname = "/"; // safety
      url.search = "";
      changed = true;
    }

    // F) Remove trailing slash for non-root, non-file paths
    if (url.pathname !== "/" && url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
      url.pathname = url.pathname.slice(0, -1);
      changed = true;
    }

    // If anything changed, emit one redirect
    if (changed && url.toString() !== incoming.toString()) {
      return redirect301(url);
    }

    // Serve asset normally
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }
};
