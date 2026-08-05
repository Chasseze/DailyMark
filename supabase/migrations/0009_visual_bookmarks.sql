-- Per-user bookmarks for curated Visuals. Same shape as thought_bookmarks
-- (0005_thought_bookmarks.sql): the catalog rotates on a short cycle in the
-- client, and bookmarks keep pieces reachable after they rotate out of Live.

create table if not exists public.visual_bookmarks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  visual_id  uuid not null references public.visuals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, visual_id)
);

create index if not exists visual_bookmarks_user_idx
  on public.visual_bookmarks (user_id, created_at desc);

alter table public.visual_bookmarks enable row level security;

drop policy if exists "own visual bookmarks: select" on public.visual_bookmarks;
create policy "own visual bookmarks: select" on public.visual_bookmarks
  for select using (auth.uid() = user_id);

drop policy if exists "own visual bookmarks: insert" on public.visual_bookmarks;
create policy "own visual bookmarks: insert" on public.visual_bookmarks
  for insert with check (auth.uid() = user_id);

drop policy if exists "own visual bookmarks: delete" on public.visual_bookmarks;
create policy "own visual bookmarks: delete" on public.visual_bookmarks
  for delete using (auth.uid() = user_id);
