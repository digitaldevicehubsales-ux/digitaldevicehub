# DigitalDeviceHub v3 — deploy notes

Files go in the site root unless noted.

| File | What to do |
|---|---|
| `index.html` | Replace the homepage (keep a backup of the old one). |
| `home-v3.css`, `home-v3.js` | New. Used by the homepage only. |
| `fonts/schibsted-grotesk-latin-wght-normal.woff2` | New. Put it in a `/fonts/` folder. Self-hosted because the site's Content-Security-Policy blocks Google Fonts. |
| `theme-v3.css` | New. Sitewide skin for every other page. |
| `trust.html` | Replace the Trust page. |

## Marketplace (and any other existing page)

Don't replace `marketplace.html`: its listing cards are filled in server-side. Make two small edits instead:

1. In `<head>`, directly after the `premium-ui.css` line, add:
   ```html
   <link rel="stylesheet" href="/theme-v3.css?v=20261011">
   ```
2. Remove `<script src="/apple-motion.js?v=20261005-studio1" defer></script>` (the theme disables its effect anyway).

The same `<link>` line can go on Help, About, Sell, Dashboard, Device and other pages to bring them into the new look.

## Bugs fixed by theme-v3.css

- `premium-ui.css` forces `display:flex !important` on `.empty-box`, which overrides the `hidden` attribute. As a result, "No matching devices." shows even when listings exist. The theme restores `[hidden]`.
- On phones, the Filters button icon has no size, so the button grows to about 290px tall. The theme sizes it to 20px.
- Scroll-reveal (`apple-motion.js`) can leave sections blank. The theme shows content immediately.

## After uploading

- The site runs a service worker. Bump its cache version so returning visitors get the new files.
- Supabase needs no changes. The homepage reads the same public tables (`listings`, `public_profiles`, `listing_images`) with the publishable key in `config.js`.
