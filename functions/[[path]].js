// /functions/[[path]].js — Canonical host + HTTPS + trailing slashes
// + Asset alias so pages using "assets/..." from subdirectories still work.
//
// Why the alias?
// If a page at /about/ uses <link href="assets/css/styles.css"> the browser
// requests /about/assets/css/styles.css. This file doesn't exist. We map any
// "/<anything>/assets/*" request back to "/assets/*" so CSS/JS/fonts/images load.
//
// NOTE: Keep only ONE routing layer: use Pages Functions OR a root _worker.js (not both).

// --- Regional pricing for No Pets Allowed! (App Store Connect price list, checked 2026-07)
// Eurozone members priced at €2.99; Canada is CA$3.99 (not $2.99); everywhere else on the
// App Store's default USD tier is $2.99.
const EUR_COUNTRIES = new Set([
  "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "HR", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
]);

function priceForCountry(country) {
  if (country === "GB") return "£2.99";
  if (country === "CA") return "CA$3.99";
  if (EUR_COUNTRIES.has(country)) return "€2.99";
  return "$2.99";
}

class PriceRewriter {
  constructor(priceText) {
    this.priceText = priceText;
  }
  element(element) {
    element.setInnerContent(this.priceText);
  }
}

// --- Live App Store rating (No Pets Allowed!, UK storefront), cached ~6h at the edge.
// Returns { value, count } or null (null => leave the number-free badge fallback and
// strip aggregateRating from the schema, so we never show a stale/invalid figure).
const APP_ID = "1205476898";

// Two-tier cache so a transient Apple failure doesn't wipe the rating:
//  - FRESH  (6h):  normal path; a hit here is served immediately.
//  - GOOD  (48h):  "last known good" fallback. On a failed/invalid fetch we
//                  serve this instead of null, so cold PoPs (and crawlers like
//                  Googlebot) still see the rating. The 48h max-age is enforced
//                  by the Cache API itself — once the last-good copy is older
//                  than 48h it stops being returned, so we never show a figure
//                  more than ~2 days stale, then cleanly fall back to stripping.
async function getRating(context) {
  const cache = caches.default;
  const freshKey = new Request("https://rating-cache.humstudios.com/app-" + APP_ID);
  const goodKey = new Request("https://rating-cache.humstudios.com/app-" + APP_ID + "-lastgood");

  const fresh = await cache.match(freshKey);
  if (fresh) { try { return await fresh.json(); } catch (e) {} }

  try {
    const api = await fetch(
      "https://itunes.apple.com/lookup?id=" + APP_ID + "&country=gb",
      { cf: { cacheTtl: 0 } }
    );
    if (api.ok) {
      const data = await api.json();
      const app = data.results && data.results[0];
      if (app && app.userRatingCount > 0 && app.averageUserRating > 0) {
        const result = {
          value: Math.round(app.averageUserRating * 10) / 10,
          count: app.userRatingCount,
        };
        const body = JSON.stringify(result);
        const fresh6h = new Response(body, {
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=21600" },
        });
        const good48h = new Response(body, {
          headers: { "Content-Type": "application/json", "Cache-Control": "max-age=172800" },
        });
        if (context && context.waitUntil) {
          context.waitUntil(cache.put(freshKey, fresh6h.clone()));
          context.waitUntil(cache.put(goodKey, good48h.clone()));
        }
        return result;
      }
    }
  } catch (e) { /* network/parse failure -> fall through to last-good */ }

  // Fetch failed or returned no usable rating: serve last-good if still <48h old.
  const good = await cache.match(goodKey);
  if (good) { try { return await good.json(); } catch (e) {} }
  return null;
}

// Fills the visible rating badge; if no rating, leaves the static fallback untouched.
class RatingBadgeRewriter {
  constructor(rating) { this.rating = rating; }
  element(el) {
    if (!this.rating) return;
    const v = this.rating.value.toFixed(1);
    const n = this.rating.count;
    // Snap the star fill to the nearest half-star; the exact figure sits alongside.
    const pct = (Math.round(this.rating.value * 2) / 2 / 5) * 100;
    el.setAttribute("aria-label", "Rated " + v + " out of 5 from " + n + " App Store ratings");
    el.setInnerContent(
      '<span class="app-rating__stars" style="--fill:' + pct + '%"></span>' +
      '<span class="app-rating__num">' + v + "</span>" +
      '<span class="app-rating__count">' + n + " App Store ratings</span>",
      { html: true }
    );
  }
}

// Fills the aggregateRating placeholders in the JSON-LD; if no rating, removes the
// whole aggregateRating property so the schema stays valid.
class SchemaRatingRewriter {
  constructor(rating) { this.rating = rating; this.buf = ""; }
  text(chunk) {
    this.buf += chunk.text;
    if (chunk.lastInTextNode) {
      let out = this.buf;
      if (this.rating) {
        out = out
          .replace("__RATING_VALUE__", this.rating.value.toFixed(1))
          .replace("__RATING_COUNT__", String(this.rating.count));
      } else {
        out = out.replace(/\s*"aggregateRating":\s*\{[^}]*\},/, "");
      }
      chunk.replace(out, { html: false });
      this.buf = "";
    } else {
      chunk.remove();
    }
  }
}

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

  // --- Canonical host + HTTPS (skip for local dev so `wrangler pages dev` works)
  const CANON = "www.humstudios.com";
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocal && (url.hostname !== CANON || url.protocol !== "https:")) {
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
  const response = await env.ASSETS.fetch(new Request(assetURL.toString(), request));

  // --- Rewrite the displayed price on the homepage to match the visitor's region
  if (url.pathname === "/" && (response.headers.get("content-type") || "").includes("text/html")) {
    const country = request.cf?.country || "US";
    const rating = await getRating(context);
    return new HTMLRewriter()
      .on(".price", new PriceRewriter(priceForCountry(country)))
      .on(".app-rating", new RatingBadgeRewriter(rating))
      .on("script#app-schema", new SchemaRatingRewriter(rating))
      .transform(response);
  }

  return response;
}
