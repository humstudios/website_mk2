// Hum Studios — Cloudflare Pages Advanced Mode Worker (single-hop redirects)
//
// Goals:
//  - One 301 to the final canonical URL (no chains)
//  - 410 for truly nonexistent phantom URLs
//  - HTTPS + www, .html → trailing slash, normalize index, handle legacy queries/paths
//
// Note: This Worker owns the whole request. Keep _redirects out of the repo.

function redirect301(url) {
  return Response.redirect(url.toString(), 301);
}

function hasFileExtension(pathname) {
  const last = pathname.split("/").pop() || "";
  return last.includes("."); // crude but sufficient (avoids adding slash after files)
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const url = new URL(incoming.toString()); // clone to mutate
    let changed = false;

    // --- A) Hard 410 for ghost URLs — return immediately (no canonicalization hop)
    const goneSet = new Set([
      "/illustration.html",
      "/animation.html",
    ]);
    if (goneSet.has(url.pathname)) {
      return new Response("Gone", { status: 410 });
    }

    // --- B) Normalize path noise first
    const normalizedPath = url.pathname.replace(/\/{2,}/g, "/");
    if (normalizedPath !== url.pathname) {
      url.pathname = normalizedPath;
      changed = true;
    }

    // --- C) Canonical host + HTTPS
    const CANONICAL_HOST = "www.humstudios.com";
    if (url.hostname !== CANONICAL_HOST) {
      url.hostname = CANONICAL_HOST;
      changed = true;
    }
    if (url.protocol !== "https:") {
      url.protocol = "https:";
      changed = true;
    }

    // --- D) Legacy query/url patterns → home
    if (url.searchParams.has("cat")) {
      url.pathname = "/";
      url.search = "";
      changed = true;
    }

    if (url.pathname === "/work" || url.pathname.startsWith("/work/")) {
      url.pathname = "/";
      url.search = "";
      changed = true;
    }

    // --- E) Index normalization
    if (url.pathname === "/index" || url.pathname === "/index.html") {
      url.pathname = "/";
      url.search = "";
      changed = true;
    }

    // --- F) .html → trailing slash (directory style)
    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.replace(/\.html$/i, "/");
      url.search = "";
      changed = true;
    }

    // --- G) Ensure trailing slash for route-like paths (not files), except root
    if (url.pathname !== "/" && !url.pathname.endsWith("/") && !hasFileExtension(url.pathname)) {
      url.pathname = url.pathname + "/";
      changed = true;
    }

    // If anything changed, send one redirect to the final canonical URL
    if (changed && url.toString() !== incoming.toString()) {
      return redirect301(url);
    }

    // Otherwise, serve asset
    return env.ASSETS.fetch(new Request(url.toString(), request));
  }
};
