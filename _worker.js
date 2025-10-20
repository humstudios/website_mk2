// Hum Studios — Cloudflare Pages Advanced Mode Worker
// Canonical host/protocol, .html normalization, legacy queries, and explicit 410s.

function redirect301(url) {
  return Response.redirect(url.toString(), 301);
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const url = new URL(incoming.toString()); // clone to mutate safely

    // --- 0) Canonical host + HTTPS ---
    const CANONICAL_HOST = "www.humstudios.com";
    if (url.hostname !== CANONICAL_HOST || url.protocol !== "https:") {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return redirect301(url);
    }

    // Normalize accidental double slashes in path (except the leading one)
    url.pathname = url.pathname.replace(/\/{2,}/g, "/");

    // --- 1) Explicit 410 for phantom URLs ---
    const goneSet = new Set([
      "/illustration.html",
      "/animation.html",
    ]);
    if (goneSet.has(url.pathname)) {
      return new Response("Gone", { status: 410 });
    }

    // --- 2) Legacy query/url patterns ---
    // Any old WP-style category/query like ?cat=5 → home
    if (url.searchParams.has("cat")) {
      url.pathname = "/";
      url.search = "";
      return redirect301(url);
    }

    // Legacy /work paths → home (adjust target later if desired)
    if (url.pathname === "/work" || url.pathname.startsWith("/work/")) {
      url.pathname = "/";
      url.search = "";
      return redirect301(url);
    }

    // --- 3) .html normalization + index.html → clean trailing-slash ---
    if (url.pathname === "/index" || url.pathname === "/index.html") {
      url.pathname = "/";
      url.search = "";
      return redirect301(url);
    }

    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/i, "/");
      return redirect301(url);
    }

    // Hand off to Pages asset serving
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }
};
