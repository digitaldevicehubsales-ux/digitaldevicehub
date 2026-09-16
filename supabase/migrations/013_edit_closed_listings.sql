drop policy if exists listings_seller_update_closed on public.listings;
create policy listings_seller_update_closed on public.listings
for update to authenticated
using (
  seller_id = (select auth.uid())
  and status in ('sold','archived')
)
with check (
  seller_id = (select auth.uid())
  and status in ('sold','archived')
);
