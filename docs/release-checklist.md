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

## Cloudflare / traffic — investigated 2026-07-22, all still to do

- [ ] **Bot traffic swamping analytics.** In 24h humstudios.com took **5.21k requests but had 0 real human visitors** (Web Analytics beacon verified working — it fires and returns 204, so the zero is real). A single IP, **135.119.63.200**, accounted for **2.98k of those requests (57%)**. RDAP confirms it as Microsoft, range `135.119.0.0/16`, network name "cloud" (i.e. Azure). Next two sources, 20.9.82.255 (429) and 4.204.201.85 (316), sit in ranges commonly used by Azure. Signature is unmistakably automated: browser and OS both report "Unknown/Others" (4.68k / 4.7k), HTTP/1.1 on 4.89k of 5.21k requests, all GET, cache hits only 121 — which is why the cache rate collapsed to 1.7%.
  - **Fix:** a custom security rule targeting that single IP. Surgical, and leaves everything else alone.
  - **⚠️ Do NOT block Microsoft's ASN or the whole IP range.** Bing crawls from Microsoft infrastructure and it's currently your second-biggest AI/search crawler (18 requests/24h). Blocking it would cost Bing indexing while chasing one bad IP.
  - **⚠️ Bot Fight Mode is the wrong tool here** (currently OFF, as is AI Labyrinth). On the free plan it's a JavaScript challenge, which legitimate non-browser fetchers — including the AI retrieval bots we *want* — can fail.
  - Side effect worth remembering: any traffic figure taken from the Cloudflare dashboard is currently meaningless. The "7.82k web traffic" headline is essentially all bot.

- [ ] **Decide on Managed robots.txt (currently ON).** It tells AI crawlers the site's content should **not be used for AI training**. That works against wanting AI assistants to know about and recommend the app. It's advisory rather than enforced, and it does *not* block live retrieval — ChatGPT/Perplexity can still fetch and cite the site in real time — but it discourages the training path that builds unprompted awareness. **Judgement call, not a technical one.** If discoverability is the priority, turn it off.
  - AI crawler activity for context (24h): OpenAI 20 (incl. ChatGPT-User 11), BingBot 18, Google 16, Baidu 11, Perplexity 9, Anthropic/ClaudeBot 5, Common Crawl 4, Apple 0, ByteDance 0. Total only 108 requests — so AI crawlers are **not** the cause of the bot problem above, and AI controls won't fix it.

- [ ] **Point links at the www hostname.** 68 of 108 AI crawls received an HTTP 301, because links use `humstudios.com` which redirects to `www.humstudios.com`. Not broken, but roughly two thirds of crawl budget is being spent on redirects.

## Rollback Plan
- How to revert (git ref/PR)
- Known risks and mitigations
