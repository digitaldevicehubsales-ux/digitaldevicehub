create or replace function public.get_my_listing_stats()
returns table (
  listing_id uuid,
  impressions bigint,
  views bigint,
  unique_visitors bigint,
  favorites bigint,
  buyer_messages bigint,
  shares bigint
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    l.id,
    (select count(*) from public.listing_events e where e.listing_id=l.id and e.event_type='impression'),
    (select count(*) from public.listing_events e where e.listing_id=l.id and e.event_type='view'),
    (select count(distinct e.visitor_id) from public.listing_events e where e.listing_id=l.id and e.event_type='view'),
    (select count(*) from public.favorites f where f.listing_id=l.id),
    (select count(*) from public.conversations c where c.listing_id=l.id),
    (select count(*) from public.listing_events e where e.listing_id=l.id and e.event_type='share')
  from public.listings l
  where l.seller_id = auth.uid();
$$;

create or replace function public.get_my_listing_trend(p_days integer default 30)
returns table (
  listing_id uuid,
  day date,
  views bigint,
  unique_visitors bigint
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    l.id,
    (e.created_at at time zone 'utc')::date as day,
    count(*) filter (where e.event_type='view') as views,
    count(distinct e.visitor_id) filter (where e.event_type='view') as unique_visitors
  from public.listings l
  join public.listing_events e on e.listing_id=l.id
  where l.seller_id=auth.uid()
    and e.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days,30), 365)))
  group by l.id, (e.created_at at time zone 'utc')::date
  order by day asc;
$$;

grant execute on function public.get_my_listing_stats() to authenticated;
grant execute on function public.get_my_listing_trend(integer) to authenticated;
