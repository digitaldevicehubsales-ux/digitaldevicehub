# Supabase backend preparation

The database schema is already prepared in:

`supabase/migrations/001_mvp_schema.sql`

It includes:

- profiles
- listings and listing images
- favorites
- buyer/seller conversations
- realtime messages
- orders
- reviews
- disputes
- row-level security policies
- a public `listing-images` storage bucket with per-user upload folders

## Security choices

- Listing moderation status cannot be promoted to `published` by a normal seller.
- Order/payment status cannot be changed by browser clients.
- Admin access is based on `app_metadata.role = admin`, which normal users cannot set themselves.
- No government-ID/KYC data is stored in the public profile table.
- No card data or payment secrets belong in Supabase tables or frontend code.
- Product image uploads are limited to JPEG/PNG/WebP and 5 MB per file.

## Zero-cost sequence

1. Create the Supabase Free project.
2. Apply `001_mvp_schema.sql`.
3. Run Supabase security/performance advisors.
4. Get the project URL and publishable key.
5. Connect the frontend.
6. Keep payment features disabled until a compliant payment-provider flow is ready.

No paid Supabase feature is required for this MVP schema.
