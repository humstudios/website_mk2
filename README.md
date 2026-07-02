# Hum Studios Website

A lightweight, accessible, static site for Hum Studios. Optimised for fast loads, robust fallbacks, clean SEO, and strict privacy.

## Project structure

```
index.html              # Landing page (animations, hero, CTAs)
about.html
contact.html
support.html
privacy.html
cookies.html
404.html

assets/
  css/
    styles.css          # Global design tokens + layout
  js/
    early-theme.session.js   # Inline theme init (prevents FOUC)
    enhancements.js          # General progressive enhancement
    hum-menu.clean.js        # Hamburger / mobile nav
    consent.js               # Cookie consent UI
    consent-bind.js          # Binds "change cookie settings" controls to the consent UI
    theme-toggle.session.js  # Light/Dark/Auto toggle
    theme-color-sync.js      # Syncs <meta name="theme-color">
    contact.js               # Contact form AJAX submit + status + Turnstile callbacks
    headline-smart-wrap.js   # Prevents widows in headings
    ios-resume-fix.js        # Resumes paused video on iOS focus
  img/
    animation/          # Videos (webm/mp4) + posters (webp/jpg)
    icons/              # SVG sprite
    logos/
    og/                 # Open Graph images (1200×630)
  fonts/

# SEO / crawl
robots.txt
sitemap.xml
google1cb35fe2fea0fd7d.html  # Google Search Console verification

# Cloudflare Pages
_headers                # Security & cache headers (Cloudflare Pages only — ignored on GitHub Pages)
functions/
  [[path]].js           # Canonical host/HTTPS/trailing-slash redirects + asset alias
  api/
    contact.js          # Pages Function: contact form handler (Turnstile verify + Resend email)
```

## Animations & fallbacks (index.html)

Each animation uses a resilient chain:

- **Formats:** `webm` (first choice), then `mp4` as fallback.
- **Posters:** baseline **JPG** via `poster=""`, upgraded to **WebP** at runtime via `data-poster-webp`.
- **Breakpoints:** small encodes for **(max-width: 424px)**, large encodes for **(min-width: 425px)**.
- **Playback attributes:** `playsinline muted autoplay loop preload="metadata"` are enforced on all `<video>`.
- **NoScript:** after each video there is a `<noscript><picture>` (WebP first, then JPG) with meaningful `alt`, and intrinsic `width`/`height` set to prevent CLS.
- **Reduced motion:** a tiny inline script detects `prefers-reduced-motion` and disables autoplay; otherwise it leaves posters visible until the browser is ready and then plays. It also upgrades posters to WebP when supported.

### File naming
Use `-anim-<width>w` for videos and `-poster-<width>w` for posters, or the existing `-300p / -360p / -600p / -720p` scheme. Keep names lowercase, hyphenated, and consistent across variants.

### Adding a new animation

1. Export sources:
   - Primary: `something-anim-<size>.webm`
   - Fallback: `something-anim-<size>.mp4`
   - Posters: `something-poster-<size>.webp` and `.jpg`
2. Add `<video>` with:
   ```html
   <video playsinline muted autoplay loop preload="metadata"
          poster="assets/img/animation/something-poster-800w.jpg"
          data-poster-webp="assets/img/animation/something-poster-800w.webp">
     <!-- small phones -->
     <source media="(max-width: 424px)" src="assets/img/animation/something-300p.webm" type="video/webm">
     <source media="(max-width: 424px)" src="assets/img/animation/something-300p.mp4"  type="video/mp4">
     <!-- larger phones and up -->
     <source media="(min-width: 425px)" src="assets/img/animation/something-600p.webm" type="video/webm">
     <source media="(min-width: 425px)" src="assets/img/animation/something-600p.mp4"  type="video/mp4">
   </video>
   <noscript>
     <picture>
       <source type="image/webp" srcset="assets/img/animation/something-poster-800w.webp">
       <img src="assets/img/animation/something-poster-800w.jpg" alt="Meaningful alt text" width="800" height="600" loading="lazy" decoding="async">
     </picture>
   </noscript>
   ```
3. Verify on devices around **425 px**—bump the breakpoint slightly if needed for your design.

## Accessibility

- All content images have `alt` (or `alt=""` if decorative). Decorative clusters (e.g. clouds) are wrapped with `aria-hidden="true"`.
- Forms/controls are labeled; links and buttons have accessible names.
- Landmarks: primary content uses `<main>`. A skip link is present on every page.
- Videos: `playsinline` avoids forced fullscreen; `muted` + `autoplay` satisfy mobile policies; fallbacks cover JS-off.
- Posters include intrinsic dimensions to minimise layout shift.

## SEO

- Unique, descriptive `<title>` and `<meta name="description">` per page.
- Open Graph and Twitter Card tags on every page; OG image URLs are absolute.
- Canonical URLs are absolute and point to `https://www.humstudios.com`.
- `sitemap.xml` lists all public pages; submitted to Google Search Console.
- `robots.txt` allows all crawlers and references the sitemap.

## Performance

- Images and posters sized to match usage; WebP preferred when supported.
- `preload="metadata"` used for videos to balance startup time and data usage.
- `.video-frame { aspect-ratio: 4/3; width: 100%; }` prevents CLS before posters paint.

## Security & privacy

- All security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, etc.) are set via `_headers`. This file is processed by **Cloudflare Pages only** — it has no effect on GitHub Pages or other hosts.
- No third-party analytics cookies. Cloudflare Web Analytics is cookieless.
- Contact form is protected by Cloudflare Turnstile (server-verified via the Cloudflare Worker).

## Local development

It's a static site — open `index.html` in a browser or serve via any static server:

```bash
# Python 3
python -m http.server 5173

# Node
npx serve .
```

Then visit `http://localhost:5173/`. Note: security headers from `_headers` are not applied locally.

## Deployment (Cloudflare Pages)

1. Push to GitHub.
2. Connect repo to Cloudflare Pages — build command: (none), output directory: `/` (root).
3. The contact form handler deploys automatically as a Pages Function (`functions/api/contact.js`):
   - Set the required environment variables in the Pages project settings:
     `TURNSTILE_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO`
     (optional: `RESEND_SUBJECT_PREFIX`, `THANK_YOU_URL`, `ALLOW_ORIGINS`, `TURNSTILE_ALLOWED_HOSTNAMES`).
4. Confirm your Turnstile **site key** in `contact.html` matches the live key in your Cloudflare dashboard.

### Post-deploy checklist

- [ ] `https://www.humstudios.com/` resolves and redirects www ↔ non-www correctly.
- [ ] Security headers present — verify with [securityheaders.com](https://securityheaders.com).
- [ ] Contact form submits and sends email; Turnstile challenge appears.
- [ ] Posters and videos load on real devices under slow 3G and normal broadband.
- [ ] Reduced-motion users see posters with no autoplay.
- [ ] Social share previews correct — test with [opengraph.xyz](https://opengraph.xyz).
- [ ] 404 page resolves and matches site styling.
- [ ] Google Search Console: submit sitemap, confirm no coverage errors.

## Maintenance

- When replacing animations, update **both** formats (webm/mp4) and **both** posters (webp/jpg). Keep the same names when possible to reuse markup.
- If you change the canonical host, update absolute URLs in HTML `<head>`, JSON-LD, and `sitemap.xml`.
- Run Lighthouse Mobile (two passes) and axe periodically; report any new findings.
- Update `sitemap.xml` `lastmod` dates whenever pages change significantly.

## License & credits

Copyright © Hum Studios Ltd. All rights reserved.  
Artwork, animations, and assets are the property of Hum Studios Ltd.
