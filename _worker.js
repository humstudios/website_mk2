// Hum Studios — Cloudflare Pages Worker (SAFE MODE)
// Goal: get the whole site back up immediately with ZERO redirect loops.
// Strategy: Serve both `/leaf` and `/leaf/` from `leaf.html` internally. Do not emit any
// trailing-slash redirects for now. Keep HTTPS + canonical host. After Pages settings are
// fixed (Trailing slash:Add/Default, Clean URLs:Off, no `_redirects` removing slashes),
// we can switch back to strict canonicalization.
//
// External redirect: host/protocol only (to https://www.humstudios.com).
// NO other external redirects in safe mode.
//
// Internal rewrite (GET + HEAD):
//   /           → /index.html
//   /leaf       → /leaf.html
//   /leaf/      → /leaf.html
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

    // 0) 410s for phantom URLs
    const goneSet = new Set(["/illustration.html", "/animation.html"]);
    if (goneSet.has(url.pathname)) return new Response("Gone", { status: 410 });

    // A) Collapse duplicate slashes
    const normalizedPath = url.pathname.replace(/\/{2,}/g, "/");
    if (normalizedPath !== url.pathname) { url.pathname = normalizedPath; changed = true; }

    // B) Canonical host + HTTPS (ONLY external redirect we perform)
    const CANONICAL_HOST = "www.humstudios.com";
    if (url.hostname !== CANONICAL_HOST) { url.hostname = CANONICAL_HOST; changed = true; }
    if (url.protocol !== "https:") { url.protocol = "https:"; changed = true; }

    // C) Legacy cleanups (internal only in safe mode)
    if (url.searchParams.has("cat")) { url.pathname = "/"; url.search = ""; }
    if (url.pathname === "/work" || url.pathname.startsWith("/work/")) { url.pathname = "/"; url.search = ""; }

    // Emit ONLY the host/HTTPS redirect, nothing else
    if (changed && url.toString() !== incoming.toString()) return redirect301(url);

    // Internal mapping: always resolve to a concrete file
    const assetURL = new URL(url.toString());
    if (assetURL.pathname === "/") {
      assetURL.pathname = "/index.html";
    } else if (!hasFileExtension(assetURL.pathname)) {
      // Map both /leaf and /leaf/ to /leaf.html
      const path = assetURL.pathname.endsWith("/") ? assetURL.pathname.slice(0, -1) : assetURL.pathname;
      assetURL.pathname = (path === "" ? "/index" : path) + ".html";
    }

    // Fetch using internal mapping so Pages serves the correct file without bouncing
    return env.ASSETS.fetch(new Request(assetURL.toString(), request));
  }
};
