alter table public.listings
  add column if not exists price_amount numeric(20,4),
  add column if not exists price_currency text;

update public.listings
set price_amount = price_ngn
where price_amount is null and price_ngn is not null;

update public.listings
set price_currency = 'NGN'
where price_currency is null;

alter table public.listings
  alter column price_ngn drop not null,
  alter column price_currency set default 'NGN';

alter table public.listings
  drop constraint if exists listings_price_amount_check,
  drop constraint if exists listings_price_currency_check;

alter table public.listings
  add constraint listings_price_amount_check check (price_amount > 0),
  add constraint listings_price_currency_check check (price_currency ~ '^[A-Z]{3}$');

create or replace function public.normalize_listing_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.price_amount is null and new.price_ngn is not null then
    new.price_amount := new.price_ngn;
    new.price_currency := coalesce(new.price_currency, 'NGN');
  end if;

  if new.price_currency is null then
    new.price_currency := 'NGN';
  end if;

  if new.price_currency = 'NGN' and new.price_ngn is null and new.price_amount is not null then
    new.price_ngn := round(new.price_amount)::bigint;
  end if;

  return new;
end;
$$;

drop trigger if exists listings_normalize_price on public.listings;
create trigger listings_normalize_price
before insert or update of price_amount, price_currency, price_ngn
on public.listings
for each row execute function public.normalize_listing_price();

alter table public.listings
  alter column price_amount set not null,
  alter column price_currency set not null;
