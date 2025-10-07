# Performance Budgets & Core Web Vitals
**Version:** 2025-10-06

Targets (mobile lab, Lighthouse):
- **LCP:** < 2.5s
- **CLS:** ≈ 0.00–0.02
- **INP:** Good

Asset budgets (guidelines):
- **CSS:** ≤ 50 KB unminified/page
- **JS:** Minimal and defer/async
- **Images:** Sized correctly; WebP/AVIF where beneficial

Method:
- Critical CSS ≤ 4 KB inline; rest in `assets/css/styles.css`.
- Only one true LCP image gets `fetchpriority="high"`.
- Lazy‑load offscreen images; include width/height to prevent CLS.
