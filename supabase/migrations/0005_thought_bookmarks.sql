-- Per-user bookmarks for curated Thoughts. The catalog rotates on a short
-- cycle in the client; bookmarks keep pieces reachable after they rotate out.

create table if not exists public.thought_bookmarks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  thought_id uuid not null references public.thoughts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, thought_id)
);

create index if not exists thought_bookmarks_user_idx
  on public.thought_bookmarks (user_id, created_at desc);

alter table public.thought_bookmarks enable row level security;

drop policy if exists "own bookmarks: select" on public.thought_bookmarks;
create policy "own bookmarks: select" on public.thought_bookmarks
  for select using (auth.uid() = user_id);

drop policy if exists "own bookmarks: insert" on public.thought_bookmarks;
create policy "own bookmarks: insert" on public.thought_bookmarks
  for insert with check (auth.uid() = user_id);

drop policy if exists "own bookmarks: delete" on public.thought_bookmarks;
create policy "own bookmarks: delete" on public.thought_bookmarks
  for delete using (auth.uid() = user_id);
