-- Harden relationship checks in marketplace RLS policies.
-- Ensures buyers cannot attach conversations or reviews to an arbitrary seller.

drop policy if exists conversations_buyer_create on public.conversations;
create policy conversations_buyer_create
on public.conversations
for insert
to authenticated
with check (
  buyer_id = (select auth.uid())
  and buyer_id <> seller_id
  and exists (
    select 1
    from public.listings l
    where l.id = conversations.listing_id
      and l.seller_id = conversations.seller_id
      and l.status = 'published'::public.listing_status
  )
);

drop policy if exists reviews_completed_buyer_create on public.reviews;
create policy reviews_completed_buyer_create
on public.reviews
for insert
to authenticated
with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1
    from public.orders o
    where o.id = reviews.order_id
      and o.buyer_id = (select auth.uid())
      and o.seller_id = reviews.seller_id
      and o.status = 'completed'::public.order_status
  )
);
