// /functions/[[path]].js — Trailing slashes + HTTPS/www; bypass Clean URLs by fetching the slashless asset
// This variant avoids Cloudflare Pages' Clean URLs 308 by requesting the *slashless* version
// from ASSETS, while keeping the public URL with a trailing slash.
//
// Public behavior:
//   - http/non‑www → https://www.humstudios.com (301)
//   - /leaf       → /leaf/ (301)
//   - /leaf/      → 200 OK (served from /leaf.html via internal fetch of "/leaf")
//   - /index.html → / (301), / → 200 OK
//
// IMPORTANT: Do not ship a root-level `_worker.js` alongside this.

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") return next();

  // Bypass static assets
  if (url.pathname.startsWith("/assets/") ||
      /\.(css|js|mjs|map|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|mp4|webm|txt|xml|pdf)$/i.test(url.pathname)) {
    return next();
  }

  const hasExt = (p) => (p.split("/").pop() || "").includes(".");

  // Canonical host + HTTPS
  const CANON = "www.humstudios.com";
  if (url.hostname !== CANON || url.protocol !== "https:") {
    url.hostname = CANON;
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }

  // Path canonicalization
  let changed = false;
  const normalized = url.pathname.replace(/\/{2,}/g, "/");
  if (normalized !== url.pathname) { url.pathname = normalized; changed = true; }

  if (url.pathname === "/index" || url.pathname === "/index.html") {
    url.pathname = "/"; url.search = ""; changed = true;
  }

  if (url.pathname.endsWith(".html")) {
    url.pathname = url.pathname.replace(/\.html$/i, "/"); url.search = ""; changed = true;
  }

  if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasExt(url.pathname)) {
    url.pathname += "/"; changed = true;
  }

  if (changed) return Response.redirect(url.toString(), 301);

  // Internal asset mapping:
  // - "/"           → fetch "/"
  // - "/leaf/"      → fetch "/leaf"   (slashless) to bypass Clean URLs redirect to /leaf
  // - anything with extension → fetch as-is
  let assetPath = url.pathname;
  if (assetPath === "/") {
    assetPath = "/";
  } else if (assetPath.endsWith("/") && !hasExt(assetPath)) {
    assetPath = assetPath.slice(0, -1); // "/leaf/"" -> "/leaf"
  }

  const assetURL = new URL(assetPath + url.search, url.origin);
  return env.ASSETS.fetch(new Request(assetURL.toString(), request));
}
