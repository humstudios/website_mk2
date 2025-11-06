// /functions/[[path]].js — Canonical host + HTTPS + trailing slashes
// + Asset alias so pages using "assets/..." from subdirectories still work.
//
// Why the alias?
// If a page at /about/ uses <link href="assets/css/styles.css"> the browser
// requests /about/assets/css/styles.css. This file doesn't exist. We map any
// "/<anything>/assets/*" request back to "/assets/*" so CSS/JS/fonts/images load.
//
// NOTE: Keep only ONE routing layer: use Pages Functions OR a root _worker.js (not both).

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") return next();

  // --- Asset alias: /foo/bar/assets/... -> /assets/...
  // Run this BEFORE the generic asset bypass so we can remap.
  const i = url.pathname.indexOf("/assets/");
  if (i > 0) {
    const newPath = url.pathname.slice(i); // keep "/assets/..."
    const assetURL = new URL(newPath + url.search, url.origin);
    return env.ASSETS.fetch(new Request(assetURL.toString(), request));
  }

  // --- Bypass obvious assets (already at root /assets/* or with file extensions)
  if (
    url.pathname.startsWith("/assets/") ||
    /\.(css|js|mjs|map|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|mp4|webm|txt|xml|pdf)$/i.test(url.pathname)
  ) {
    return next();
  }

  const hasExt = (p) => (p.split("/").pop() || "").includes(".");

  // --- Canonical host + HTTPS
  const CANON = "www.humstudios.com";
  if (url.hostname !== CANON || url.protocol !== "https:") {
    url.hostname = CANON;
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }

  // --- Path canonicalization
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

  // --- Internal asset mapping to avoid Clean URLs 308:
  // "/" → fetch "/"
  // "/leaf/" → fetch "/leaf" (slashless) so Pages serves leaf.html without bouncing
  let assetPath = url.pathname;
  if (assetPath === "/") {
    assetPath = "/";
  } else if (assetPath.endsWith("/") && !hasExt(assetPath)) {
    assetPath = assetPath.slice(0, -1);
  }

  const assetURL = new URL(assetPath + url.search, url.origin);
  return env.ASSETS.fetch(new Request(assetURL.toString(), request));
}
