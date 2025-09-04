// file: functions/_middleware.ts
// Redirect all GET/HEAD requests to /maintenance.html
// Allows /maintenance.html itself and Cloudflare internal routes.
// Adjust the allowlist as needed (e.g., keep /api/ working during maintenance).

export const onRequest: PagesFunction = async (ctx) => {
  const { request } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  // Allow the maintenance page and CF internal assets
  if (path === "/maintenance.html" || path.startsWith("/cdn-cgi/")) {
    return ctx.next();
  }

  // If you want APIs to remain available during maintenance, uncomment:
  // if (path.startsWith("/api/")) {
  //   return ctx.next();
  // }

  // Only redirect safe read methods (avoid breaking form POSTs behind the scenes)
  if (request.method === "GET" || request.method === "HEAD") {
    return Response.redirect(`${url.origin}/maintenance.html`, 302);
  }

  // For other methods, just continue (or you can block if you prefer)
  return ctx.next();
};
