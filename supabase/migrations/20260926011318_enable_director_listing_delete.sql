alter table public.orders alter column listing_id drop not null;
alter table public.orders drop constraint if exists orders_listing_id_fkey;
alter table public.orders add constraint orders_listing_id_fkey foreign key (listing_id) references public.listings(id) on delete set null;

drop policy if exists listing_images_storage_delete_director on storage.objects;
create policy listing_images_storage_delete_director
on storage.objects
for delete
to authenticated
using (bucket_id = 'listing-images' and public.is_director());

create or replace function public.director_delete_listing(p_listing_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_listing public.listings%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_director() then
    raise exception 'Director authorization required' using errcode = '42501';
  end if;

  if length(v_reason) < 10 then
    raise exception 'Deletion reason must be at least 10 characters' using errcode = '22023';
  end if;

  select * into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  insert into public.moderation_actions(
    admin_id, listing_id, subject_user_id, action, note, assigned_to
  ) values (
    auth.uid(),
    v_listing.id,
    v_listing.seller_id,
    'director_delete_listing',
    'Director permanently deleted listing "' || coalesce(v_listing.title, v_listing.id::text) || '". Reason: ' || v_reason,
    auth.uid()
  );

  delete from public.listings where id = p_listing_id;

  return jsonb_build_object(
    'id', v_listing.id,
    'title', v_listing.title,
    'seller_id', v_listing.seller_id
  );
end;
$$;

revoke all on function public.director_delete_listing(uuid, text) from public;
grant execute on function public.director_delete_listing(uuid, text) to authenticated;
