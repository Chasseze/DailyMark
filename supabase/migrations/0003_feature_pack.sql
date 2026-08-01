-- Soft delete, full-text search, quiz sync, and note image storage.

-- ─── Soft delete on notes ────────────────────────────────────────────────────

alter table public.notes
  add column if not exists deleted_at timestamptz;

create index if not exists notes_user_active_idx
  on public.notes (user_id, is_pinned desc, updated_at desc)
  where deleted_at is null;

create index if not exists notes_user_trash_idx
  on public.notes (user_id, deleted_at desc)
  where deleted_at is not null;

-- ─── Full-text search ────────────────────────────────────────────────────────

alter table public.notes
  add column if not exists search_vector tsvector;

create or replace function public.notes_set_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'A');
  return new;
end;
$$;

drop trigger if exists notes_search_vector_biu on public.notes;
create trigger notes_search_vector_biu
  before insert or update of title, content, tags on public.notes
  for each row
  execute function public.notes_set_search_vector();

update public.notes
set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'A')
where search_vector is null;

create index if not exists notes_search_vector_idx
  on public.notes using gin (search_vector);

-- Returns slim list rows matching a query for the calling user (active notes only).
create or replace function public.search_notes(q text)
returns table (
  id uuid,
  user_id uuid,
  notebook_id uuid,
  title text,
  preview text,
  is_pinned boolean,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    n.id,
    n.user_id,
    n.notebook_id,
    n.title,
    n.preview,
    n.is_pinned,
    n.tags,
    n.created_at,
    n.updated_at,
    n.deleted_at,
    ts_rank(n.search_vector, websearch_to_tsquery('english', q))::real as rank
  from public.notes n
  where n.user_id = auth.uid()
    and n.deleted_at is null
    and length(trim(q)) > 0
    and n.search_vector @@ websearch_to_tsquery('english', q)
  order by rank desc, n.is_pinned desc, n.updated_at desc
  limit 100;
$$;

grant execute on function public.search_notes(text) to authenticated;

-- ─── Quiz progress (cross-device sync) ────────────────────────────────────────

create table if not exists public.quiz_progress (
  user_id      uuid not null references auth.users (id) on delete cascade,
  date_key     date not null,
  attempt      integer not null default 0 check (attempt >= 0),
  question_ids text[] not null default '{}',
  index        integer not null default 0 check (index >= 0),
  score        integer not null default 0 check (score >= 0),
  selected     text,
  phase        text not null default 'ready'
               check (phase in ('ready', 'question', 'feedback', 'results')),
  updated_at   timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.quiz_progress enable row level security;

create policy "own quiz: select" on public.quiz_progress
  for select using (auth.uid() = user_id);
create policy "own quiz: insert" on public.quiz_progress
  for insert with check (auth.uid() = user_id);
create policy "own quiz: update" on public.quiz_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own quiz: delete" on public.quiz_progress
  for delete using (auth.uid() = user_id);

drop trigger if exists quiz_progress_set_updated_at on public.quiz_progress;
create trigger quiz_progress_set_updated_at
  before update on public.quiz_progress
  for each row execute function public.set_updated_at();

-- ─── Note images (Storage) ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-images',
  'note-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Paths are `{user_id}/{note_id}/{filename}` so RLS can match the owner folder.
drop policy if exists "note images: select" on storage.objects;
create policy "note images: select" on storage.objects
  for select using (bucket_id = 'note-images');

drop policy if exists "note images: insert" on storage.objects;
create policy "note images: insert" on storage.objects
  for insert with check (
    bucket_id = 'note-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "note images: update" on storage.objects;
create policy "note images: update" on storage.objects
  for update using (
    bucket_id = 'note-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'note-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "note images: delete" on storage.objects;
create policy "note images: delete" on storage.objects
  for delete using (
    bucket_id = 'note-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
