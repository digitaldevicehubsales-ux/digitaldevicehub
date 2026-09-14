-- Scope authenticated-only policies explicitly and evaluate auth.uid() once per statement.

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists listings_admin_all on public.listings;
drop policy if exists listings_insert_own on public.listings;
drop policy if exists listings_public_read_published on public.listings;
drop policy if exists listings_update_own_prepublication on public.listings;

create policy listings_public_read_published on public.listings
for select to public
using (
  status = 'published'::public.listing_status
  or seller_id = (select auth.uid())
  or public.is_admin()
);

create policy listings_insert_own on public.listings
for insert to authenticated
with check (
  seller_id = (select auth.uid())
  and status = any (array['draft'::public.listing_status, 'pending'::public.listing_status])
);

create policy listings_update_seller_or_admin on public.listings
for update to authenticated
using (
  public.is_admin()
  or (
    seller_id = (select auth.uid())
    and status = any (array['draft'::public.listing_status, 'pending'::public.listing_status, 'rejected'::public.listing_status, 'archived'::public.listing_status])
  )
)
with check (
  public.is_admin()
  or (
    seller_id = (select auth.uid())
    and status = any (array['draft'::public.listing_status, 'pending'::public.listing_status, 'archived'::public.listing_status])
  )
);

create policy listings_admin_delete on public.listings
for delete to authenticated
using (public.is_admin());

drop policy if exists listing_images_read on public.listing_images;
drop policy if exists listing_images_insert_own_listing on public.listing_images;
drop policy if exists listing_images_delete_own_listing on public.listing_images;

create policy listing_images_read on public.listing_images
for select to public
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.status = 'published'::public.listing_status
        or l.seller_id = (select auth.uid())
        or public.is_admin()
      )
  )
);

create policy listing_images_insert_own_listing on public.listing_images
for insert to authenticated
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and l.seller_id = (select auth.uid())
  )
);

create policy listing_images_delete_own_listing on public.listing_images
for delete to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and l.seller_id = (select auth.uid())
  )
);

drop policy if exists favorites_own_all on public.favorites;
create policy favorites_own_all on public.favorites
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists conversations_participant_read on public.conversations;
create policy conversations_participant_read on public.conversations
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
);

drop policy if exists messages_participant_read on public.messages;
drop policy if exists messages_participant_send on public.messages;

create policy messages_participant_read on public.messages
for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
  )
);

create policy messages_participant_send on public.messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
  )
);

drop policy if exists orders_admin_all on public.orders;
drop policy if exists orders_participant_read on public.orders;

create policy orders_participant_read on public.orders
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
  or public.is_admin()
);

create policy orders_admin_update on public.orders
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy orders_admin_delete on public.orders
for delete to authenticated
using (public.is_admin());

drop policy if exists disputes_admin_all on public.disputes;
drop policy if exists disputes_participant_read on public.disputes;
drop policy if exists disputes_participant_create on public.disputes;

create policy disputes_participant_read on public.disputes
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = disputes.order_id
      and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
  )
);

create policy disputes_participant_create on public.disputes
for insert to authenticated
with check (
  opened_by = (select auth.uid())
  and exists (
    select 1 from public.orders o
    where o.id = disputes.order_id
      and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
  )
);

create policy disputes_admin_update on public.disputes
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy disputes_admin_delete on public.disputes
for delete to authenticated
using (public.is_admin());
