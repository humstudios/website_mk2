# Environments & Indexing Matrix
**Version:** 2025-10-06

| Environment | Hostname example | Indexable? | X‑Robots‑Tag | Meta robots | robots.txt | Canonical policy |
|---|---|---|---|---|---|---|
| Production | www.humstudios.com | **Yes** | (none) | (none) | `Sitemap: ...` | Absolute to www |
| CF Preview | *.pages.dev | **No** | `noindex, nofollow` | (n/a) | (any) | Canonical still to www |
| GH Preview | <your GH pages host> | **No** | (n/a) | `noindex, nofollow` | `Disallow: /` | Canonical still to www |

Notes: Do not include preview URLs in sitemap. Keep preview canonical pointing to production URLs.
