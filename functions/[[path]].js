// /functions/[[path]].js — Trailing slashes + HTTPS/www host enforcement (no head injection)
// Hum Studios — Pages Functions catch‑all
//
// Public policy: **trailing slashes** everywhere. Files on disk are flat *.html.
// This function:
//   • Enforces canonical host & HTTPS → https://www.humstudios.com
//   • Redirects once to canonical path: /index.html → /, *.html → /leaf/, /leaf → /leaf/
//   • Internally serves / and /leaf/ from /index.html and /leaf.html (no extra redirect).
//   • Handles GET and HEAD. Skips assets and non‑HTML requests.
//   • No head injection.
//
// IMPORTANT: Do not ship a root‑level `_worker.js` alongside this; keep one routing layer only.

export async function onRequest(context) {
  const { request, env, next } = context;
  const incoming = new URL(request.url);
  const url = new URL(incoming.toString());

  // Only handle GET/HEAD navigations
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();

  // Bypass obvious static assets and API endpoints
  if (
    url.pathname.startsWith("/assets/") ||
    /\.(css|js|mjs|map|json|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|webm|txt|xml|pdf)$/i.test(url.pathname)
  ) {
    return next();
  }

  // Helpers
  const hasExt = (p) => {
    const last = (p.split("/").pop() || "");
    return last.includes(".");
  };

  // A) Canonical host + HTTPS (external 301)
  const CANON_HOST = "www.humstudios.com";
  let hostChanged = false;
  if (url.hostname !== CANON_HOST) { url.hostname = CANON_HOST; hostChanged = true; }
  if (url.protocol !== "https:")   { url.protocol = "https:";   hostChanged = true; }
  if (hostChanged) return Response.redirect(url.toString(), 301);

  // B) Path canonicalization (single 301 hop max)
  let changed = false;

  // Collapse duplicate slashes
  const normalized = url.pathname.replace(/\/{2,}/g, "/");
  if (normalized !== url.pathname) { url.pathname = normalized; changed = true; }

  // Optional legacy cleanups
  if (url.searchParams.has("cat")) { url.pathname = "/"; url.search = ""; changed = true; }
  if (url.pathname === "/work" || url.pathname.startsWith("/work/")) { url.pathname = "/"; url.search = ""; changed = true; }

  // /index or /index.html → /
  if (url.pathname === "/index" || url.pathname === "/index.html") {
    url.pathname = "/"; url.search = ""; changed = true;
  }

  // *.html → strip + add trailing slash
  if (url.pathname.endsWith(".html")) {
    url.pathname = url.pathname.replace(/\.html$/i, "/");
    if (url.pathname === "") url.pathname = "/";
    url.search = "";
    changed = true;
  }

  // Add trailing slash to non-root, non-file paths
  if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasExt(url.pathname)) {
    url.pathname = url.pathname + "/";
    changed = true;
  }

  if (changed) return Response.redirect(url.toString(), 301);

  // C) Internal mapping to physical .html (NO redirect)
  const assetURL = new URL(url.toString());
  if (assetURL.pathname === "/") {
    assetURL.pathname = "/index.html";
  } else if (assetURL.pathname.endsWith("/") && !hasExt(assetURL.pathname)) {
    assetURL.pathname = assetURL.pathname.slice(0, -1) + ".html";
  }

  // Fetch the mapped asset directly from static files
  return env.ASSETS.fetch(new Request(assetURL.toString(), request));
}
