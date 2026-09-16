alter table public.listings
  add column if not exists specs jsonb not null default '{}'::jsonb,
  add column if not exists country_code text,
  add column if not exists delivery_mode text not null default 'pickup',
  add column if not exists warranty_text text;

alter table public.listings drop constraint if exists listings_country_code_check;
alter table public.listings add constraint listings_country_code_check check (country_code is null or country_code ~ '^[A-Z]{2}$');

alter table public.listings drop constraint if exists listings_delivery_mode_check;
alter table public.listings add constraint listings_delivery_mode_check check (delivery_mode in ('pickup','domestic','international','pickup_domestic','all'));

create index if not exists listings_marketplace_filter_idx on public.listings(status, category, condition, created_at desc);
create index if not exists listings_country_idx on public.listings(country_code) where country_code is not null;
create index if not exists listings_brand_idx on public.listings(brand);

alter table public.profiles
  add column if not exists preferred_language text default 'en',
  add column if not exists preferred_country_code text;

alter table public.profiles drop constraint if exists profiles_preferred_country_code_check;
alter table public.profiles add constraint profiles_preferred_country_code_check check (preferred_country_code is null or preferred_country_code ~ '^[A-Z]{2}$');