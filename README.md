# Hum Studios Website

A lightweight, accessible, static site for Hum Studios. This repo/page set is optimized for fast loads, robust fallbacks, and clean SEO.

## Project structure
```
assets/
  css/            # Stylesheets
  img/animation/  # Videos (webm/mp4) + posters (webp/jpg)
  img/…           # Other images
  js/             # (optional) your scripts
index.html        # Landing page with animations and all fallbacks
404.html          # Custom not-found page
partials/         # (If used) HTML snippets like clouds.html
```
> Note: This is the **only** page with animations and fallback logic.

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
- Landmarks: primary content uses `<main>` (where applicable). A skip link is recommended.
- Videos: `playsinline` avoids forced fullscreen; `muted` + `autoplay` satisfy mobile policies; fallbacks cover JS-off.
- Posters include intrinsic dimensions to minimize layout shift.

## SEO
- Unique, descriptive `<title>` and `<meta name="description">` per page.
- Open Graph/Twitter tags present on the landing page.
- `VideoObject` JSON‑LD present (optional in future): **thumbnails and content URLs are absolute** (configured for `https://www.humstudios.com`). Update the host if deploying to a different domain.
- Canonical link recommended once final domain is confirmed.

## Performance
- Images and posters sized to match usage; WebP preferred when supported.
- `preload="metadata"` used for videos to balance startup time and data usage.
- `.video-frame { aspect-ratio: 4/3; width: 100%; }` prevents CLS before posters paint.

## Local development
It’s a static site—open `index.html` in a browser or serve via any static server:
```bash
# Python 3
python -m http.server 5173

# Node
npx serve .
```
Then visit `http://localhost:5173/` (or whichever port your server uses).

## Deployment
Host on any static provider (Netlify, Vercel, GitHub Pages, S3+CloudFront). If using Cloudflare, note that **analytics may be injected server-side**—no GA/GTM snippets are embedded in the HTML.

### Post‑deploy checklist (quick)
- [ ] Canonical domain resolves (www/non-www redirect to one HTTPS host).
- [ ] Posters and videos load on real devices under slow 3G and normal broadband.
- [ ] Reduced-motion users see posters and no autoplay.
- [ ] Social share previews show correct image/description.
- [ ] 404 page resolves and matches site styling.

## Maintenance
- When replacing animations, update **both** formats (webm/mp4) and **both** posters (webp/jpg). Keep the same names when possible to reuse markup.
- If you change the canonical host, update absolute URLs in the JSON‑LD.
- Consider periodically running an a11y scan (e.g., Axe, Lighthouse) and an LCP check.

## License & credits
Copyright © Hum Studios. All rights reserved.
Artwork, animations, and assets are the property of Hum Studios.
