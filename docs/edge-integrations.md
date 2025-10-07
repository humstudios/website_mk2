# Edge Integrations — Cloudflare
**Version:** 2025-10-06

## Turnstile
- Client: widget on Contact page.
- Server: verify token at the edge (Worker); reject on failure; rate‑limit.

## Analytics (Cloudflare Web Analytics)
- Injected at the edge (no snippet in repo).
- Disclose on Privacy/Cookies pages.

## Env Vars / Secrets
| Name | Purpose | Scope |
|---|---|---|
| TURNSTILE_SECRET | Verify tokens | Worker |
| CONTACT_TO | Email routing | Worker |
