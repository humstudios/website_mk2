// Inject /partials/head.html on every HTML page.
// Adds two extra font preloads on the homepage only.
export async function onRequest(context) {
  // --- safety guard: bypass non-HTML + assets; handle only GET/HEAD ---
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return next();
  }

  // Never intercept static assets
  if (
    url.pathname.startsWith('/assets/') ||
    /\.(css|js|mjs|map|json|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4|webm)$/i.test(url.pathname)
  ) {
    return next();
  }

  // Fetch downstream response first; only rewrite HTML
  const res = await next();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) return res;

  const isHome = url.pathname === '/' || url.pathname.endsWith('/index.html');

  // Load shared head partial from static assets
  // (Pages Functions provides an ASSETS binding for your project files)
  const headUrl = new URL('/partials/head.html', request.url);
  let headHtml = '';
  try {
    const headRes = await env.ASSETS.fetch(headUrl.toString());
    if (headRes.ok) headHtml = await headRes.text();
  } catch (_) {
    // If the partial can't be fetched, just return the original response
  }
  if (!headHtml) return res;

  // Optional: homepage-only extra font preloads
  const EXTRA = isHome
    ? `<!-- Optional homepage-only font preloads -->
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Overpass-Medium-500.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/Overpass-SemiBold-600.woff2" crossorigin>`
    : '';

  const snippet = EXTRA + headHtml;

  // Prepend the snippet inside <head>
  const transformer = new HTMLRewriter().on('head', {
    element(el) {
      el.prepend(snippet, { html: true });
    }
  });

  return transformer.transform(res);
}
