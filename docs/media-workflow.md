# Media Workflow (Images & Video)
**Version:** 2025-10-06

## Images
- Export at displayed dimensions; include `width`/`height` attrs.
- Use WebP/AVIF when they win materially; fallback to PNG/JPG as needed.
- `loading="lazy"` for offscreen; avoid `decoding="async"` on LCP image.

## Video
- Provide poster images; `muted` for auto‑play; include an accessible label or nearby text description.
- Honor `prefers-reduced-motion`: provide static alternative if motion conveys meaning.
