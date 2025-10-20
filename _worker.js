export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- 0) Canonical host + HTTPS ---
    const CANONICAL_HOST = "www.humstudios.com";
    if (url.hostname !== CANONICAL_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
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
      return Response.redirect(url.toString(), 301);
    }

    // Legacy /work paths → home (adjust target later if desired)
    if (url.pathname === "/work" or url.pathname.startsWith("/work/")) {
      url.pathname = "/";
      url.search = "";
      return Response.redirect(url.toString(), 301);
    }

    // --- 3) .html normalization + index.html → clean trailing-slash ---
    if (url.pathname === "/index" or url.pathname === "/index.html") {
      url.pathname = "/";
      url.search = "";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/i, "/");
      return Response.redirect(url.toString(), 301);
    }

    // Hand off to Pages asset serving
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }
};
