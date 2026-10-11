# DigitalDeviceHub v3: uniform look across every page

Already live: `index.html`, `home-v3.css`, `home-v3.js`, `trust.html`, `fonts/…woff2`.

## Step 1: replace one file

Upload the new **`theme-v3.css`** over the old one. It now covers every page on the site.

## Step 2: add the theme to every other page

Make these two edits in **each** HTML page listed below:

1. Directly after the line that loads `premium-ui.css` (whatever its `?v=` number), add:
   ```html
   <link rel="stylesheet" href="/theme-v3.css?v=20261011b">
   ```
2. Delete the `apple-motion.js` script line if the page has one:
   ```html
   <script src="/apple-motion.js?v=20261005-studio1" defer></script>
   ```

Pages:

- /marketplace
- /phones, /phones/iphone, /laptops, /tablets, /accessories, /wearables
- /guides/buying-used-iphone
- /sell
- /device/… (the listing page template)
- /compare
- /help, /contact, /about, /regions, /seller-onboarding
- /privacy, /terms
- /dashboard, /admin

Do not change `index.html`, which has its own styles. `trust.html` already has the theme line; just bump its `?v=` to `20261011b`.

Prompt you can paste into ChatGPT or Codex with the files:

> In every .html file of my site except index.html, add `<link rel="stylesheet" href="/theme-v3.css?v=20261011b">` on the line directly after the existing premium-ui.css stylesheet link, and remove any `<script>` tag that loads apple-motion.js. In trust.html, change theme-v3.css?v=20261011 to theme-v3.css?v=20261011b. Change nothing else.

## Step 3: clear caches

Bump the service worker's cache version so returning visitors get the new files.

## Live-site bugs this theme fixes

- **Marketplace:** "No matching devices." showed even when listings existed, because `premium-ui.css` overrides the `hidden` attribute.
- **Marketplace on phones:** the Filters button icon had no size, so the button was about 290px tall.
- **All pages:** the scroll-reveal effect could leave sections blank.
- **Dashboard when signed out:** the sign-in box was squeezed into a 160px strip, because the hidden sidebar still reserved its column.

Supabase needs no changes.
