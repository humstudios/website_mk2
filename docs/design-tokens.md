# Design Tokens — Hum Studios
**Version:** 2025-10-06

Keep tokens in `assets/css/styles.css`. This doc is the human‑readable source of truth.

## Colors
| Token | Light | Dark | Usage |
|---|---|---|---|
| --color-bg |  |  | Page background |
| --color-fg |  |  | Body text |
| --color-accent |  |  | Buttons/links |
| --color-card |  |  | Card surfaces |
| --color-muted |  |  | Subtle text |

## Typography
| Token | Value | Notes |
|---|---|---|
| --font-sans |  | WOFF2 self‑hosted, `font-display: swap` |
| --text-sm |  |  |
| --text-base |  |  |
| --text-lg |  |  |
| --text-xl |  |  |

## Spacing & Radius & Shadows
| Token | Value | Notes |
|---|---|---|
| --space-1 |  |  |
| --space-2 |  |  |
| --radius-xl |  |  |
| --shadow-card |  |  |

> Rule: Prefer tokens over raw values. `!important` allowed only for theme/3rd‑party escapes (document in code).

## Head: color-scheme & theme-color meta
Signal light/dark support in every page `<head>` so the browser renders form controls, scrollbars and (on mobile) the status/tab bar to match the active scheme:

```html
<meta name="color-scheme" content="light dark">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
<meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#0b1220">
```

- `color-scheme: light dark` is the minimum; the two `theme-color` variants are optional but tint mobile browser UI per scheme — keep the hex values in sync with the page background tokens.
- Pair with `:root { color-scheme: light dark }` and the `html[data-theme="light"|"dark"]` overrides the theme toggle sets.

*(Replaces the former `docs/head-*-meta.html` demo pages, removed 2026-07-09 — they were unreferenced and shipped live.)*
