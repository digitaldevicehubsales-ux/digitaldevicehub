# DigitalDeviceHub

Zero-cost validation MVP for **digitaldevicehub.com**.

## Stack

- Static HTML/CSS/JavaScript frontend at the repository root
- Cloudflare Pages Free for deployment
- Cloudflare DNS, SSL and DNSSEC
- Supabase Free backend schema under `supabase/`

## Cloudflare Pages deployment

Connect this repository to Cloudflare Pages and use:

- Framework preset: **None**
- Build command: **leave blank**
- Build output directory: **/** (repository root)

Then add these custom domains in the Pages project:

- `digitaldevicehub.com`
- `www.digitaldevicehub.com`

No paid hosting or build service is required for this static MVP.

## Backend

The prepared Supabase migration is in:

`supabase/migrations/001_mvp_schema.sql`

It includes marketplace tables, Row Level Security, product-image storage policies, and realtime messaging preparation. Payment processing is deliberately disabled until a compliant payment provider is integrated.
