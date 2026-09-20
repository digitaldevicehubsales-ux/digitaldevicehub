# DigitalDeviceHub

DigitalDeviceHub is **the global marketplace built specifically for digital devices** — New and Used phones, laptops, tablets, accessories, wearables and other approved technology categories.

The product is designed around structured device information, clear condition, seller context, seller-entered prices in their own currencies, buyer-facing local-currency estimates, country-aware discovery, and local/domestic/international delivery scopes. No single country or currency is treated as the marketplace's business identity or base market.

**Positioning:** Clear condition. Seller context. Local relevance. Global reach.

## Stack

- Static HTML/CSS/JavaScript frontend at the repository root
- Cloudflare Pages / Workers Free for deployment
- Cloudflare DNS, SSL and DNSSEC
- Supabase Free backend for authentication, database, storage, marketplace messaging, moderation and server-side marketplace services

## Global marketplace principles

- Listings require an ISO country/region code.
- Sellers set the authoritative asking price in their chosen ISO 4217 currency.
- Buyers may see a local-currency estimate based on detected locale and cached FX data.
- Marketplace filters support country/region and city/locality.
- Sellers can specify local pickup, domestic shipping, international shipping, or a combination.
- Legal, privacy, safety and transaction disclosures are written for international use and defer to applicable local law.

## Cloudflare deployment

Connect this repository to Cloudflare and serve the repository root as the static asset directory. Custom domains:

- `digitaldevicehub.com`
- `www.digitaldevicehub.com`

## Backend

Supabase migrations define marketplace tables, Row Level Security, product-image storage policies, seller tools, moderation, analytics, multi-currency pricing, localization and global marketplace fields.

Payment, escrow and logistics protections must only be represented as available when a compliant provider and complete transaction workflow exist for the relevant market.
