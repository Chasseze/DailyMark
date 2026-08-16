-- DailyMark v2 desk foundations:
-- account prefs, Return reasons, personal library collections, local-day streak.

-- ─── Account prefs (theme, notes mood, speech, reminder) ─────────────────────
alter table public.profiles
  add column if not exists prefs jsonb not null default '{}'::jsonb;

comment on column public.profiles.prefs is
  'Cross-device UI prefs (theme, notesMood, speech, reminder, focus).';

-- ─── Return: freeze reason labels with the day's pile ────────────────────────
alter table public.return_sessions
  add column if not exists reasons text[] not null default '{}';

-- ─── Personal library collections (Thoughts + Visuals) ───────────────────────
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

-- ─── Streak uses the caller's local calendar day ─────────────────────────────
drop function if exists public.touch_streak();
drop function if exists public.touch_streak(date);

create or replace function public.touch_streak(p_local_day date default null)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.touch_streak(date) to authenticated;
