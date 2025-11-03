// Hum Studios — Cloudflare Pages Worker (canonical: trailing slashes preserved for leaf pages)
//
// Rationale: Hum Studios site and sitemap use trailing slashes (e.g. /about/). This Worker enforces
// consistency: all leaf routes end with a trailing slash, no .html, HTTPS + www enforced.
// Canonicalization:
//  - Force HTTPS + www
//  - Drop `.html` → bare path with trailing slash (e.g., /about.html → /about/)
//  - /index.html → /
//  - Add trailing slash on non-root, non-file paths
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

    // If anything changed, emit one redirect
    if (changed && url.toString() !== incoming.toString()) {
      return redirect301(url);
    }

    // Serve asset normally
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }
};
