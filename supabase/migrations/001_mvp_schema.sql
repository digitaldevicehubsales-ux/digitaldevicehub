-- DigitalDeviceHub zero-cost MVP schema for Supabase
-- Safe starting point: no payment capture, no escrow logic, no secrets.
-- Apply this migration only after creating a Supabase project.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ---------- user profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- listings ----------
create type public.listing_condition as enum ('new', 'excellent', 'good', 'fair');
create type public.listing_status as enum ('draft', 'pending', 'published', 'sold', 'rejected', 'archived');

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  category text not null check (category in ('Phones','Laptops','Tablets','Accessories','Wearables')),
  brand text not null,
  model text not null,
  condition public.listing_condition not null,
  price_ngn bigint not null check (price_ngn > 0),
  description text not null default '',
  storage text,
  color text,
  city text,
  status public.listing_status not null default 'pending',
  moderation_note text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_status_category_idx on public.listings(status, category);
create index if not exists listings_seller_idx on public.listings(seller_id);
create index if not exists listings_price_idx on public.listings(price_ngn);
create index if not exists listings_created_idx on public.listings(created_at desc);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique(listing_id, storage_path)
);

create index if not exists listing_images_listing_idx on public.listing_images(listing_id, sort_order);

-- ---------- favorites ----------
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------- conversations/messages ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create index if not exists conversations_buyer_idx on public.conversations(buyer_id, created_at desc);
create index if not exists conversations_seller_idx on public.conversations(seller_id, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

-- ---------- orders / reviews / disputes ----------
create type public.order_status as enum ('created', 'awaiting_payment', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'disputed');

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  amount_ngn bigint not null check (amount_ngn > 0),
  status public.order_status not null default 'created',
  payment_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create index if not exists orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders(seller_id, created_at desc);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create type public.dispute_status as enum ('open', 'under_review', 'resolved', 'closed');

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  reason text not null check (char_length(reason) between 10 and 2000),
  status public.dispute_status not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists disputes_order_idx on public.disputes(order_id);
create trigger disputes_set_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;

-- Profiles: public marketplace identity only. No private ID documents belong here.
create policy "profiles_public_read"
on public.profiles for select
using (true);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Listings
create policy "listings_public_read_published"
on public.listings for select
using (
  status = 'published'
  or seller_id = auth.uid()
  or public.is_admin()
);

create policy "listings_insert_own"
on public.listings for insert
with check (
  seller_id = auth.uid()
  and status in ('draft','pending')
);

create policy "listings_update_own_prepublication"
on public.listings for update
using (
  seller_id = auth.uid()
  and status in ('draft','pending','rejected','archived')
)
with check (
  seller_id = auth.uid()
  and status in ('draft','pending','archived')
);

create policy "listings_admin_all"
on public.listings for all
using (public.is_admin())
with check (public.is_admin());

-- Listing images inherit listing visibility.
create policy "listing_images_read"
on public.listing_images for select
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (l.status = 'published' or l.seller_id = auth.uid() or public.is_admin())
  )
);

create policy "listing_images_insert_own_listing"
on public.listing_images for insert
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid()
  )
);

create policy "listing_images_delete_own_listing"
on public.listing_images for delete
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid()
  )
);

-- Favorites are private.
create policy "favorites_own_all"
on public.favorites for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Conversations are visible only to participants.
create policy "conversations_participant_read"
on public.conversations for select
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conversations_buyer_create"
on public.conversations for insert
with check (
  auth.uid() = buyer_id
  and buyer_id <> seller_id
  and exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.seller_id = seller_id
      and l.status = 'published'
  )
);

-- Messages are visible/writable only by conversation participants.
create policy "messages_participant_read"
on public.messages for select
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
  )
);

create policy "messages_participant_send"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
  )
);

-- Orders: users can read their own orders.
-- Order status updates should be done by trusted server/payment webhook code, not the browser.
create policy "orders_participant_read"
on public.orders for select
using (
  auth.uid() = buyer_id
  or auth.uid() = seller_id
  or public.is_admin()
);

create policy "orders_admin_all"
on public.orders for all
using (public.is_admin())
with check (public.is_admin());

-- Reviews: everyone can read. Only the buyer of a completed order can create one.
create policy "reviews_public_read"
on public.reviews for select
using (true);

create policy "reviews_completed_buyer_create"
on public.reviews for insert
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.buyer_id = auth.uid()
      and o.seller_id = seller_id
      and o.status = 'completed'
  )
);

-- Disputes: order participants can open/read. Admin handles status/resolution.
create policy "disputes_participant_read"
on public.disputes for select
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

create policy "disputes_participant_create"
on public.disputes for insert
with check (
  opened_by = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

create policy "disputes_admin_all"
on public.disputes for all
using (public.is_admin())
with check (public.is_admin());

-- ---------- Storage bucket for product images ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listing_images_storage_public_read" on storage.objects;
create policy "listing_images_storage_public_read"
on storage.objects for select
using (bucket_id = 'listing-images');

drop policy if exists "listing_images_storage_insert_own_folder" on storage.objects;
create policy "listing_images_storage_insert_own_folder"
on storage.objects for insert
with check (
  bucket_id = 'listing-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "listing_images_storage_update_own_folder" on storage.objects;
create policy "listing_images_storage_update_own_folder"
on storage.objects for update
using (
  bucket_id = 'listing-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'listing-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "listing_images_storage_delete_own_folder" on storage.objects;
create policy "listing_images_storage_delete_own_folder"
on storage.objects for delete
using (
  bucket_id = 'listing-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ---------- Realtime ----------
-- Supabase may already have this publication; adding only messages is enough for MVP chat.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;
