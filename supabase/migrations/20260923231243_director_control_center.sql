begin;

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('director','admin','moderator','support'));

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role','director')
where lower(email) = lower('digitaldevicehubsales@gmail.com');

insert into public.admin_users (user_id, role, granted_by)
select id, 'director', id
from auth.users
where lower(email) = lower('digitaldevicehubsales@gmail.com')
on conflict (user_id) do update
set role = excluded.role,
    granted_by = excluded.granted_by,
    granted_at = now();

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','director'), false)
     and exists (
       select 1 from public.admin_users a
       where a.user_id = auth.uid()
         and a.role in ('admin','director')
     );
$$;

create or replace function public.is_director()
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','director'), false)
     and exists (
       select 1 from public.admin_users a
       where a.user_id = auth.uid()
         and a.role = 'director'
     );
$$;

revoke all on function public.is_director() from public;
grant execute on function public.is_director() to authenticated;

create table if not exists public.director_decisions (
  id bigint generated always as identity primary key,
  director_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 160),
  decision text not null check (char_length(trim(decision)) between 3 and 5000),
  status text not null default 'open' check (status in ('open','approved','implemented','archived')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.director_decisions enable row level security;
drop policy if exists director_decisions_director_all on public.director_decisions;
create policy director_decisions_director_all
on public.director_decisions
for all
to authenticated
using (public.is_director())
with check (public.is_director() and director_id = (select auth.uid()));

grant select, insert, update, delete on public.director_decisions to authenticated;
grant usage, select on sequence public.director_decisions_id_seq to authenticated;

drop trigger if exists director_decisions_set_updated_at on public.director_decisions;
create trigger director_decisions_set_updated_at
before update on public.director_decisions
for each row execute function public.set_updated_at();

create index if not exists director_decisions_status_created_idx
on public.director_decisions (status, created_at desc);

drop policy if exists offers_director_update on public.offers;
create policy offers_director_update
on public.offers
for update
to authenticated
using (public.is_director())
with check (public.is_director());

commit;
