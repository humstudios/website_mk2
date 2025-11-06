
// /functions/[[path]].js — Trailing slashes + HTTPS/www host enforcement + head injection
// Hum Studios (Pages Functions, catch‑all)

export async function onRequest(context) {
  const { request, env, next } = context;
  const incoming = new URL(request.url);
  const url = new URL(incoming.toString());

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();

  if (
    url.pathname.startsWith("/assets/") ||
    /\.(css|js|mjs|map|json|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|webm|txt|xml|pdf)$/i.test(url.pathname)
  ) {
    return next();
  }

  const hasExt = (p) => {
    const last = (p.split("/").pop() || "");
    return last.includes(".");
  };

  // Canonical host + HTTPS
  const CANON_HOST = "www.humstudios.com";
  let hostChanged = false;
  if (url.hostname !== CANON_HOST) { url.hostname = CANON_HOST; hostChanged = true; }
  if (url.protocol !== "https:")   { url.protocol = "https:";   hostChanged = true; }
  if (hostChanged) return Response.redirect(url.toString(), 301);

  // Path canonicalization
  let changed = false;
  const normalized = url.pathname.replace(/\/{2,}/g, "/");
  if (normalized !== url.pathname) { url.pathname = normalized; changed = true; }
  if (url.searchParams.has("cat")) { url.pathname = "/"; url.search = ""; changed = true; }
  if (url.pathname === "/work" || url.pathname.startsWith("/work/")) { url.pathname = "/"; url.search = ""; changed = true; }
  if (url.pathname === "/index" || url.pathname === "/index.html") { url.pathname = "/"; url.search = ""; changed = true; }
  if (url.pathname.endsWith(".html")) {
    url.pathname = url.pathname.replace(/\.html$/i, "/");
    if (url.pathname === "") url.pathname = "/";
    url.search = "";
    changed = true;
  }
  if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasExt(url.pathname)) {
    url.pathname = url.pathname + "/";
    changed = true;
  }
  if (changed) return Response.redirect(url.toString(), 301);

  // Internal rewrite to physical .html
  const assetURL = new URL(url.toString());
  if (assetURL.pathname === "/") assetURL.pathname = "/index.html";
  else if (assetURL.pathname.endsWith("/") && !hasExt(assetURL.pathname))
    assetURL.pathname = assetURL.pathname.slice(0, -1) + ".html";

  let res = await env.ASSETS.fetch(new Request(assetURL.toString(), request));
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;

  // Optional head injection
  let headHtml = "";
  try {
    const headRes = await env.ASSETS.fetch(new URL("/partials/head.html", request.url));
    if (headRes.ok) headHtml = await headRes.text();
  } catch (_) {}

  const isHome = url.pathname === "/";
  const EXTRA = isHome
    ? `<!-- Homepage font preloads -->
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Overpass-Medium-500.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Overpass-SemiBold-600.woff2" crossorigin>`
    : "";

  const snippet = (headHtml ? EXTRA + headHtml : EXTRA);
  if (!snippet) return res;

  const transformer = new HTMLRewriter().on("head", {
    element(el) {
      el.prepend(snippet, { html: true });
    }
  });

  return transformer.transform(res);
}
