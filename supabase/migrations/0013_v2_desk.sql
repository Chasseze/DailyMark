-- DailyMark v2 desk. This file is PostgreSQL only.
-- Paste the entire contents into the Supabase SQL editor (SQL, not a .tsx file).

-- Account prefs
alter table public.profiles
  add column if not exists prefs jsonb not null default jsonb_build_object();

comment on column public.profiles.prefs is
  'Cross-device UI prefs (theme, notesMood, speech, reminder, focus).';

-- Return session table (in case 0012 was never applied) plus frozen reasons
create table if not exists public.return_sessions (
  user_id     uuid not null references auth.users (id) on delete cascade,
  date_key    date not null,
  queued_ids  text[] not null default array[]::text[],
  done_ids    text[] not null default array[]::text[],
  updated_at  timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.return_sessions
  add column if not exists reasons text[] not null default array[]::text[];

alter table public.return_sessions enable row level security;

drop policy if exists "own return: select" on public.return_sessions;
drop policy if exists "own return: insert" on public.return_sessions;
drop policy if exists "own return: update" on public.return_sessions;
drop policy if exists "own return: delete" on public.return_sessions;

create policy "own return: select" on public.return_sessions
  for select using (auth.uid() = user_id);
create policy "own return: insert" on public.return_sessions
  for insert with check (auth.uid() = user_id);
create policy "own return: update" on public.return_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own return: delete" on public.return_sessions
  for delete using (auth.uid() = user_id);

drop trigger if exists return_sessions_set_updated_at on public.return_sessions;
create trigger return_sessions_set_updated_at
  before update on public.return_sessions
  for each row execute function public.set_updated_at();

-- Personal library collections
create table if not exists public.library_collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 80),
  kind        text not null check (kind in ('thought', 'visual')),
  created_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

create table if not exists public.library_collection_items (
  collection_id  uuid not null references public.library_collections (id) on delete cascade,
  item_id        uuid not null,
  created_at     timestamptz not null default now(),
  primary key (collection_id, item_id)
);

create index if not exists library_collections_user_kind_idx
  on public.library_collections (user_id, kind);

alter table public.library_collections enable row level security;
alter table public.library_collection_items enable row level security;

drop policy if exists "own library collections: select" on public.library_collections;
drop policy if exists "own library collections: insert" on public.library_collections;
drop policy if exists "own library collections: update" on public.library_collections;
drop policy if exists "own library collections: delete" on public.library_collections;
drop policy if exists "own library items: select" on public.library_collection_items;
drop policy if exists "own library items: insert" on public.library_collection_items;
drop policy if exists "own library items: delete" on public.library_collection_items;

create policy "own library collections: select" on public.library_collections
  for select using (auth.uid() = user_id);
create policy "own library collections: insert" on public.library_collections
  for insert with check (auth.uid() = user_id);
create policy "own library collections: update" on public.library_collections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own library collections: delete" on public.library_collections
  for delete using (auth.uid() = user_id);

create policy "own library items: select" on public.library_collection_items
  for select using (
    exists (
      select 1 from public.library_collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
create policy "own library items: insert" on public.library_collection_items
  for insert with check (
    exists (
      select 1 from public.library_collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
create policy "own library items: delete" on public.library_collection_items
  for delete using (
    exists (
      select 1 from public.library_collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.library_collections to authenticated;
grant select, insert, update, delete on public.library_collection_items to authenticated;
grant select, insert, update, delete on public.return_sessions to authenticated;

-- Streak: drop every overload, then recreate with a local-day argument.
-- Named dollar-quotes so a SQL editor cannot confuse this with JavaScript.
do $desk$
declare
  r record;
begin
  for r in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'touch_streak'
  loop
    execute format('drop function if exists public.touch_streak(%s)', r.args);
  end loop;
end
$desk$;

create or replace function public.touch_streak(p_local_day date default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $touch_streak$
declare
  uid uuid := auth.uid();
  today date := coalesce(p_local_day, (current_timestamp at time zone 'utc')::date);
  result public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles as p (id, streak, last_visit)
  values (uid, 1, today)
  on conflict (id) do update set
    streak = case
      when p.last_visit = excluded.last_visit then p.streak
      when p.last_visit = excluded.last_visit - 1 then p.streak + 1
      else 1
    end,
    last_visit = excluded.last_visit
  returning * into result;

  return result;
end;
$touch_streak$;

revoke all on function public.touch_streak(date) from public;
grant execute on function public.touch_streak(date) to authenticated;
grant execute on function public.touch_streak(date) to service_role;
