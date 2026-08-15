-- Daily Return queue (cross-device sync). Same shape as quiz_progress:
-- one row per user per local calendar day. The frozen queued_ids and the
-- Keep/Later marks (done_ids) have to travel with the account, or a second
-- browser rebuilds a different evening pile.

create table if not exists public.return_sessions (
  user_id     uuid not null references auth.users (id) on delete cascade,
  date_key    date not null,
  queued_ids  text[] not null default '{}',
  done_ids    text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.return_sessions enable row level security;

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
