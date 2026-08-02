-- Idea pack: revisit deadlines, pinned Thought, collections, daily mood, share links.

-- ─── Notes: gentle revisit deadline ──────────────────────────────────────────

alter table public.notes
  add column if not exists revisit_at timestamptz;

create index if not exists notes_user_revisit_idx
  on public.notes (user_id, revisit_at)
  where deleted_at is null and revisit_at is not null;

-- ─── Profiles: Thought of the week pin ───────────────────────────────────────

alter table public.profiles
  add column if not exists pinned_thought_id uuid
  references public.thoughts (id) on delete set null;

-- ─── Thoughts: collections ───────────────────────────────────────────────────

alter table public.thoughts
  add column if not exists collection text not null default '';

update public.thoughts set collection = 'Habits' where id = 'a1111111-1111-4111-8111-111111111101' and collection = '';
update public.thoughts set collection = 'Focus' where id = 'a1111111-1111-4111-8111-111111111102' and collection = '';
update public.thoughts set collection = 'Creativity' where id = 'a1111111-1111-4111-8111-111111111103' and collection = '';
update public.thoughts set collection = 'Growth' where id = 'a1111111-1111-4111-8111-111111111104' and collection = '';
update public.thoughts set collection = 'Writing' where id = 'a1111111-1111-4111-8111-111111111105' and collection = '';
update public.thoughts set collection = 'Routines' where id = 'a1111111-1111-4111-8111-111111111106' and collection = '';

-- ─── Daily mood check-in ─────────────────────────────────────────────────────

create table if not exists public.daily_moods (
  user_id    uuid not null references auth.users (id) on delete cascade,
  date_key   date not null,
  mood       text not null check (char_length(mood) between 1 and 40),
  note       text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.daily_moods enable row level security;

drop policy if exists "own mood: select" on public.daily_moods;
create policy "own mood: select" on public.daily_moods
  for select using (auth.uid() = user_id);
drop policy if exists "own mood: insert" on public.daily_moods;
create policy "own mood: insert" on public.daily_moods
  for insert with check (auth.uid() = user_id);
drop policy if exists "own mood: update" on public.daily_moods;
create policy "own mood: update" on public.daily_moods
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own mood: delete" on public.daily_moods;
create policy "own mood: delete" on public.daily_moods
  for delete using (auth.uid() = user_id);

-- ─── Share tokens (read-only public links) ───────────────────────────────────

create table if not exists public.share_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,
  target_type text not null check (target_type in ('note', 'notebook')),
  note_id     uuid references public.notes (id) on delete cascade,
  notebook_id uuid references public.notebooks (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  check (
    (target_type = 'note' and note_id is not null and notebook_id is null)
    or (target_type = 'notebook' and notebook_id is not null and note_id is null)
  )
);

create index if not exists share_tokens_token_idx on public.share_tokens (token)
  where revoked_at is null;

alter table public.share_tokens enable row level security;

drop policy if exists "own shares: select" on public.share_tokens;
create policy "own shares: select" on public.share_tokens
  for select using (auth.uid() = user_id);
drop policy if exists "own shares: insert" on public.share_tokens;
create policy "own shares: insert" on public.share_tokens
  for insert with check (auth.uid() = user_id);
drop policy if exists "own shares: update" on public.share_tokens;
create policy "own shares: update" on public.share_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own shares: delete" on public.share_tokens;
create policy "own shares: delete" on public.share_tokens
  for delete using (auth.uid() = user_id);

-- Public snapshot by token (bypasses owner RLS safely for active shares only).
create or replace function public.get_shared_content(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  share public.share_tokens%rowtype;
  payload jsonb;
begin
  select * into share
  from public.share_tokens
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if not found then
    return null;
  end if;

  if share.target_type = 'note' then
    select jsonb_build_object(
      'type', 'note',
      'title', n.title,
      'content', n.content,
      'tags', n.tags,
      'shared_at', share.created_at
    )
    into payload
    from public.notes n
    where n.id = share.note_id
      and n.deleted_at is null;
    return payload;
  end if;

  select jsonb_build_object(
    'type', 'notebook',
    'title', nb.name,
    'shared_at', share.created_at,
    'notes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'title', n.title,
            'content', n.content,
            'tags', n.tags,
            'updated_at', n.updated_at
          )
          order by n.is_pinned desc, n.updated_at desc
        )
        from public.notes n
        where n.notebook_id = share.notebook_id
          and n.user_id = share.user_id
          and n.deleted_at is null
      ),
      '[]'::jsonb
    )
  )
  into payload
  from public.notebooks nb
  where nb.id = share.notebook_id;

  return payload;
end;
$$;

grant execute on function public.get_shared_content(text) to anon, authenticated;
