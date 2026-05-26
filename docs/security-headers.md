# Security & Privacy Headers
**Version:** 2025-10-06

Target: strict but compatible defaults.

## Headers (production)
- **Content-Security-Policy (CSP):** allow self; allow static.cloudflareinsights.com for Cloudflare Analytics; disallow inline except trusted boot script if needed; object-src 'none'; base-uri 'self'.
- **Referrer-Policy:** no-referrer-when-downgrade (or stricter: same-origin / strict-origin-when-cross-origin).
- **Permissions-Policy:** camera=(), microphone=(), geolocation=().
- **X-Content-Type-Options:** nosniff.
- **Strict-Transport-Security (HSTS):** enable once canonical host is stable (e.g., `max-age=31536000; includeSubDomains; preload`).

## Notes
- No analytics snippets in repo; Cloudflare Analytics injected at edge.
- Update CSP allowlist when adding new third‑parties; document rationale.
