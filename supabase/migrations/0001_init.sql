-- DailyMark initial schema.
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Every table is protected by row-level security. This is not optional: the
-- anon key shipped in the browser bundle is public by design, so RLS is the
-- only thing standing between one user's notes and everybody else's.

-- ─── notebooks ───────────────────────────────────────────────────────────────

create table if not exists public.notebooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  color      text not null default '#6b7280' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create index if not exists notebooks_user_id_idx
  on public.notebooks (user_id, created_at);

alter table public.notebooks enable row level security;

create policy "own notebooks: select" on public.notebooks
  for select using (auth.uid() = user_id);
create policy "own notebooks: insert" on public.notebooks
  for insert with check (auth.uid() = user_id);
create policy "own notebooks: update" on public.notebooks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notebooks: delete" on public.notebooks
  for delete using (auth.uid() = user_id);

-- ─── notes ───────────────────────────────────────────────────────────────────

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Deleting a notebook keeps its notes; they just fall back to "no notebook".
  notebook_id uuid references public.notebooks (id) on delete set null,
  title       text not null default '',
  content     text not null default '',
  is_pinned   boolean not null default false,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Matches the list query: a user's notes, pinned first, newest first.
create index if not exists notes_user_id_idx
  on public.notes (user_id, is_pinned desc, updated_at desc);

alter table public.notes enable row level security;

create policy "own notes: select" on public.notes
  for select using (auth.uid() = user_id);
create policy "own notes: insert" on public.notes
  for insert with check (auth.uid() = user_id);
create policy "own notes: update" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notes: delete" on public.notes
  for delete using (auth.uid() = user_id);

-- ─── profiles (daily streak) ─────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  streak     integer not null default 0 check (streak >= 0),
  last_visit date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile: select" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile: insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "own profile: update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ─── triggers ────────────────────────────────────────────────────────────────

-- The client never sets updated_at; the database owns it, so a note's sort
-- order can't drift from reality if a write path forgets to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Give every new account a profile row and the three starter notebooks, so a
-- fresh login lands on a usable app instead of an empty shell.
-- security definer: this runs as the table owner because the signing-up user
-- has no session yet. search_path is pinned to '' to block search-path attacks,
-- which is why every name below is schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
    on conflict (id) do nothing;

  insert into public.notebooks (user_id, name, color) values
    (new.id, 'Inbox',   '#6b7280'),
    (new.id, 'Ideas',   '#f59e0b'),
    (new.id, 'Journal', '#3b82f6');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── streak ──────────────────────────────────────────────────────────────────

-- Rolls the visit streak forward and returns the updated profile.
--
-- This is a database function rather than a read-then-write in the client
-- because it has to be atomic: React StrictMode calls effects twice, and two
-- tabs can open at once. Both would read the same stale streak and double-count
-- it. Here the whole thing is one statement, and calling it again the same day
-- is a no-op because last_visit already equals current_date.
--
-- security invoker: it runs as the caller, so RLS still applies and auth.uid()
-- is the only row it can ever touch.
--
-- Note: current_date is the database's date (UTC on Supabase by default), so
-- the day boundary is UTC rather than the user's local midnight.
create or replace function public.touch_streak()
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.profiles;
begin
  insert into public.profiles as p (id, streak, last_visit)
    values (auth.uid(), 1, current_date)
  on conflict (id) do update
    set streak = case
          when p.last_visit = current_date     then p.streak
          when p.last_visit = current_date - 1 then p.streak + 1
          else 1
        end,
        last_visit = current_date
  returning * into result;

  return result;
end;
$$;
