-- Cover foreign keys used by marketplace lookups and RLS joins.
create index if not exists disputes_opened_by_idx on public.disputes(opened_by);
create index if not exists favorites_listing_idx on public.favorites(listing_id);
create index if not exists orders_listing_idx on public.orders(listing_id);
create index if not exists reviews_reviewer_idx on public.reviews(reviewer_id);
create index if not exists reviews_seller_idx on public.reviews(seller_id);
