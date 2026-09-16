create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Saved search',
  query jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches(user_id, created_at desc);
alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_own_all on public.saved_searches;
create policy saved_searches_own_all on public.saved_searches for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create table if not exists public.recently_viewed (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists recently_viewed_user_idx on public.recently_viewed(user_id, viewed_at desc);
alter table public.recently_viewed enable row level security;
drop policy if exists recently_viewed_own_all on public.recently_viewed;
create policy recently_viewed_own_all on public.recently_viewed for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('listing_status','price_drop','message','account','system')),
  title text not null,
  body text not null,
  listing_id uuid references public.listings(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id, read_at) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create or replace function public.notify_listing_changes() returns trigger language plpgsql security definer set search_path=public,auth as $$
begin
  if old.status is distinct from new.status then
    insert into public.notifications(user_id,kind,title,body,listing_id)
    values (new.seller_id,'listing_status',case new.status when 'published' then 'Listing approved' when 'rejected' then 'Listing needs changes' when 'sold' then 'Listing marked sold' when 'paused' then 'Listing paused' else 'Listing status updated' end,case new.status when 'published' then new.title||' is now live in the marketplace.' when 'rejected' then new.title||' was returned for changes. Open My Listings to review it.' when 'sold' then new.title||' is now marked as sold.' when 'paused' then new.title||' is hidden from public marketplace results.' else new.title||' is now '||new.status::text||'.' end,new.id);
  end if;
  if old.price_amount is distinct from new.price_amount and old.price_amount is not null and new.price_amount is not null and new.price_amount < old.price_amount and old.price_currency = new.price_currency then
    insert into public.notifications(user_id,kind,title,body,listing_id)
    select f.user_id,'price_drop','Price dropped',new.title||' has a lower asking price now.',new.id from public.favorites f where f.listing_id=new.id and f.user_id<>new.seller_id;
  end if;
  return new;
end;$$;
drop trigger if exists listings_notify_changes on public.listings;
create trigger listings_notify_changes after update of status,price_amount,price_currency on public.listings for each row execute function public.notify_listing_changes();

create or replace function public.notify_new_message() returns trigger language plpgsql security definer set search_path=public,auth as $$
declare c public.conversations%rowtype; recipient uuid; listing_title text;
begin
  select * into c from public.conversations where id=new.conversation_id;
  if c.id is null then return new; end if;
  recipient:=case when new.sender_id=c.buyer_id then c.seller_id else c.buyer_id end;
  select title into listing_title from public.listings where id=c.listing_id;
  insert into public.notifications(user_id,kind,title,body,listing_id) values(recipient,'message','New marketplace message',coalesce(listing_title,'A device')||' has a new message.',c.listing_id);
  return new;
end;$$;
drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient after insert on public.messages for each row execute function public.notify_new_message();