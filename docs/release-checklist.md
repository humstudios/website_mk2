# Release Checklist & Rollback Plan
**Version:** 2025-10-06

## Pre‑flight
- [ ] A11y smoke (keyboard, headings, alt, reduced‑motion)
- [ ] Performance sanity (LCP, CLS, INP)
- [ ] SEO sanity (titles, canonicals, OG; sitemap updated)
- [ ] Security headers/CSP verified
- [ ] Preview envs are `noindex`; production indexable
- [ ] Links checked (internal)

## Outstanding fixes
- [x] **Turnstile — dark widget on light mode (mobile).** Fixed 2026-07-09: switched `contact.html` to explicit Turnstile render (`api.js?render=explicit&onload=onloadTurnstile`) and pass the *site's* resolved theme (`html[data-theme]`, falling back to `prefers-color-scheme`) instead of Turnstile's OS-following `auto`. Re-renders on the `hum:themechange` toggle event. **Verify on live site (needs real domain/sitekey — won't render on localhost).**
- [x] **Turnstile — width (mobile).** Fixed 2026-07-09: render with `size: 'flexible'` so the widget fills the container to match the input/message field width instead of the fixed ~300px box. **Verify on live site.**
- [x] **Privacy page — mobile bullet indentation.** Fixed 2026-07-09: added a `max-width: 47.99em` rule setting `.card :is(ul, ol) { padding-inline-start: 1.25rem }` in `styles.css` (was the browser-default ~40px). Desktop unchanged. **Note: styles.css is edge-cached — purge Cloudflare cache after deploy or it'll serve the old CSS.**

## Rollback Plan
- How to revert (git ref/PR)
- Known risks and mitigations
