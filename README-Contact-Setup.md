# Contact Form (Cloudflare Pages + Resend + Turnstile)

This implements a secure contact endpoint using **Cloudflare Pages Functions**, **Cloudflare Turnstile** (bot protection), and **Resend** (email delivery).

## Files

- `functions/api/contact.js` — serverless function handling POST, verifying Turnstile, and sending via Resend.
- `assets/js/contact.js` — optional progressive enhancement for AJAX submit + nice UX.
- `contact-snippet.html` — a minimal form snippet showing the expected fields.

Keep asset paths **relative** so GitHub Pages previews keep working.

## Configure (Cloudflare Pages)

In your Cloudflare Pages project → **Settings → Environment variables** (for both *Preview* and *Production*):

- `RESEND_API_KEY` — Your Resend API key.
- `CONTACT_TO` — Recipient email(s), comma-separated. Example: `hello@humstudios.com`.
- `CONTACT_FROM` — Verified sender. Example: `Hum Studios <no-reply@send.humstudios.com>`.
- `TURNSTILE_SECRET_KEY` — Your Turnstile **secret** (server-side).

Optional:
- `CONTACT_SUBJECT`
- `CONTACT_CC`
- `CONTACT_BCC`
- `CONTACT_ALLOWED_ORIGIN` — e.g. `https://www.humstudios.com` for CORS. Defaults to the request Origin.

## Turnstile

1. Add the public **site key** to your page in the `data-sitekey` attribute.
2. The widget injects a hidden input named **`cf-turnstile-response`** which the function validates server-side.

## Resend (domain & sender)

1. In Resend, add & verify a sending domain (prefer a subdomain like `send.humstudios.com`). Set required **SPF** and **DKIM** DNS records at your DNS provider (Cloudflare). Also add the MX feedback record if Resend asks.
2. Create a sender identity that matches `CONTACT_FROM` and use it in the function.

## Local/Preview

- On GitHub Pages preview there is no serverless runtime. The `assets/js/contact.js` respects an optional `window.CONTACT_FALLBACK_URL` — if defined, it will submit to that instead (e.g. your existing temporary fallback).
- For Cloudflare local dev, use `wrangler pages dev` from your project root so the `/functions` folder is mounted.

## Testing

- Use Resend's test addresses (e.g. `delivered@resend.dev`) as `CONTACT_TO` to simulate delivery outcomes.
- Use your form with JS disabled to confirm server POST + redirect still works.

## Security notes

- All secrets live server-side as environment variables. Never expose them on the client.
- Turnstile is **mandatory**; do not skip server-side verification.
- Basic size limits and validation help reduce abuse. Consider adding logs/alerts in Cloudflare or Resend as needed.

