# DigitalDeviceHub v3: whole-site theme

Upload these 7 files to your site root, replacing the existing ones:

| File | What changed |
|---|---|
| `theme-v3.css` | Final theme: one shared header, footer, phone menu and bottom bar for every page (homepage included), plus all page fixes |
| `index.html`, `home-v3.css`, `home-v3.js` | Homepage now uses the shared header and footer and your real logo, so it matches every other page |
| `mobile-nav.js` | One line added at the top that loads the theme. The rest is your original code, unchanged. |
| `apple-motion.js` | Same one-line loader added at the top (covers /dashboard, which doesn't load mobile-nav.js). The rest is unchanged. |
| `service-worker.js` | Cache bumped to ddh-v68, and the new theme, homepage and font files added for offline use |

No HTML edits are needed. Every page already loads `mobile-nav.js` or `apple-motion.js`, so all 20 pages pick up the theme automatically.

Optional, later: to stop the old look flashing for a split second on slow connections, add
`<link rel="stylesheet" href="/theme-v3.css?v=20261011c">` after the `premium-ui.css` line in each HTML file. The loader detects this line and won't add the theme twice.

## Already live (no action needed)
`trust.html`, `fonts/schibsted-grotesk-latin-wght-normal.woff2`

## Live-site bugs the theme fixes
- **Marketplace:** "No matching devices." showed even when listings existed.
- **Marketplace on phones:** the Filters button was about 290px tall.
- **All pages:** the scroll-reveal effect could leave sections blank.
- **Dashboard when signed out:** the sign-in box was squeezed into a 160px strip.
- **Dashboard when signed in:** the welcome card's white text sat on white, the Sell progress bar showed every step as complete, and the Admin heading was misaligned.
