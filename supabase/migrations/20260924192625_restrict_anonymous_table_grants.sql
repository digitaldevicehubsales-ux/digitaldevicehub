-- Anonymous visitors only need read access to explicitly public marketplace data.
-- RLS remains the row-level enforcement layer, but table grants should also
-- follow least privilege so a future policy mistake cannot expose write paths.

revoke all privileges on all tables in schema public from anon;

grant select on table public.listings to anon;
grant select on table public.listing_images to anon;
grant select on table public.listing_specs to anon;
grant select on table public.public_profile_cards to anon;
grant select on table public.public_profiles to anon;
grant select on table public.reviews to anon;
grant select on table public.fx_snapshots to anon;

-- RPC execution grants are intentionally unchanged. In particular,
-- record_listing_event remains callable by anonymous visitors and performs its
-- own published-listing and rate-limit checks as a SECURITY DEFINER function.
