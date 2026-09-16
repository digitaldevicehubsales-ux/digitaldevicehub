drop policy if exists listings_update_seller_or_admin on public.listings;
drop policy if exists listings_admin_update on public.listings;
drop policy if exists listings_seller_update_unpublished on public.listings;
drop policy if exists listings_seller_update_live on public.listings;
drop policy if exists listings_seller_update_paused on public.listings;

create policy listings_admin_update on public.listings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy listings_seller_update_unpublished on public.listings
for update to authenticated
using (
  seller_id = (select auth.uid())
  and status in ('draft','pending','rejected')
)
with check (
  seller_id = (select auth.uid())
  and status in ('draft','pending','archived')
);

create policy listings_seller_update_live on public.listings
for update to authenticated
using (
  seller_id = (select auth.uid())
  and status = 'published'
)
with check (
  seller_id = (select auth.uid())
  and status in ('published','pending','paused','sold','archived')
);

create policy listings_seller_update_paused on public.listings
for update to authenticated
using (
  seller_id = (select auth.uid())
  and status = 'paused'
)
with check (
  seller_id = (select auth.uid())
  and status in ('published','pending','paused','sold','archived')
);

create or replace function public.enforce_listing_re_review()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if old.seller_id = auth.uid()
     and not public.is_admin()
     and old.status in ('published','paused')
     and (
       new.category is distinct from old.category
       or new.brand is distinct from old.brand
       or new.model is distinct from old.model
       or new.condition is distinct from old.condition
     ) then
    new.status := 'pending';
    new.published_at := null;
    new.paused_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_enforce_re_review on public.listings;
create trigger listings_enforce_re_review
before update on public.listings
for each row execute function public.enforce_listing_re_review();
