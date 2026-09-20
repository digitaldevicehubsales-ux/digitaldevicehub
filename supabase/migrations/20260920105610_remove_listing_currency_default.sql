-- Global marketplace hardening: require sellers to choose the listing currency explicitly.
-- This removes the last database-level single-currency fallback without altering existing listing prices.
alter table public.listings
  alter column price_currency drop default;
