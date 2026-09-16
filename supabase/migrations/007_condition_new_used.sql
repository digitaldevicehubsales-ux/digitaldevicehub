-- Simplify marketplace condition to exactly New or Used.

create type public.listing_condition_new_used as enum ('new', 'used');

alter table public.listings
  alter column condition type public.listing_condition_new_used
  using (
    case
      when condition::text = 'new' then 'new'
      else 'used'
    end
  )::public.listing_condition_new_used;

drop type public.listing_condition;
alter type public.listing_condition_new_used rename to listing_condition;
