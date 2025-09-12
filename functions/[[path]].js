// Inject /partials/head.html on every page and add extra font preloads on the homepage only.
\1
// --- safety guard: bypass non-HTML + assets; handle only GET/HEAD ---
const { request, next } = context;
const url = new URL(request.url);

if (request.method !== 'GET' && request.method !== 'HEAD') {
  return next();
}

if (
  url.pathname.startsWith('/assets/') ||
  /\.(css|js|mjs|map|json|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|webm)$/i.test(url.pathname)
) {
  return next();
}

  const res = await context.next();
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;

  const { request, env } = context;
  const url = new URL(request.url);
  const isHome = url.pathname === "/" || url.pathname.endsWith("/index.html");

  // Load shared head partial
  const headUrl = new URL("/partials/head.html", url);
  let headHtml = "";
  try {
    const headRes = await env.ASSETS.fetch(headUrl.toString());
    if (headRes.ok) headHtml = await headRes.text();
  } catch (e) {
    // fall through
  }
  if (!headHtml) return res;

  // Optional extra preloads only on the homepage
  const EXTRA = `
    <!-- Optional homepage-only font preloads -->
    <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Overpass-Medium-500.woff2" crossorigin>
    <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Overpass-SemiBold-600.woff2" crossorigin>
  `;

  const snippet = (isHome ? EXTRA : "") + headHtml;

  const transformer = new HTMLRewriter().on("head", {
    element(el) {
      el.prepend(snippet, { html: true });
    }
  });

  return transformer.transform(res);
}
