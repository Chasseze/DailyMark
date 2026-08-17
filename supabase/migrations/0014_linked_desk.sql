-- DailyMark linked desk. This file is PostgreSQL only.
-- Paste the entire contents into the Supabase SQL editor (SQL, not a .tsx file).
--
-- Three additions, one migration:
--   1. note_backlinks()  — which notes point at this one through [[wiki links]]
--   2. notes.revisit_step — how many times a note has been pushed forward
--   3. note_quiz_pool()  — notes carrying cloze candidates, for the notes quiz

-- ─── 1. Backlinks ────────────────────────────────────────────────────────────
--
-- Wiki links are written as [[Note title]] and resolved by title, so the
-- inbound side has to be found by reading every note's body. The match is
-- deliberately identical to expandWikiLinks() in src/lib/wiki-links.ts: the
-- same `\[\[([^\]]+)\]\]` shape, the label trimmed, compared case-insensitively,
-- and an empty title standing in as "Untitled". Extracting the labels and
-- comparing them as text (rather than building a regex out of the title) means
-- a title containing regex metacharacters cannot change what gets matched.
--
-- This reads the body of every live note the caller owns. That is fine at the
-- scale one person writes at; if a library ever outgrows it, the answer is a
-- note_links table maintained on save, not a cleverer query here.

create or replace function public.note_backlinks(p_note_id uuid)
returns table (
  id          uuid,
  title       text,
  preview     text,
  updated_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $note_backlinks$
  with target as (
    select lower(btrim(coalesce(nullif(btrim(n.title), ''), 'Untitled'))) as label
    from public.notes n
    where n.id = p_note_id
      and n.user_id = auth.uid()
  )
  select n.id, n.title, n.preview, n.updated_at
  from public.notes n
  where n.user_id = auth.uid()
    and n.id <> p_note_id
    and n.deleted_at is null
    and exists (
      select 1
      from regexp_matches(n.content, '\[\[([^\]]+)\]\]', 'g') as m
      where lower(btrim(m[1])) = (select label from target)
    )
  order by n.updated_at desc
  limit 50;
$note_backlinks$;

revoke all on function public.note_backlinks(uuid) from public;
grant execute on function public.note_backlinks(uuid) to authenticated;

-- ─── 2. Return spacing ladder ────────────────────────────────────────────────
--
-- "In a week" used to mean exactly seven days every time, however often a note
-- had already been pushed forward. This column is the rung: each deferral moves
-- one step up RETURN_LADDER in src/lib/return-queue.ts (3d → 1w → 3w → 2mo) and
-- Keep resets it to 0. The ladder itself lives in the client so the copy on the
-- button and the date it sets can never disagree.

alter table public.notes
  add column if not exists revisit_step smallint not null default 0;

comment on column public.notes.revisit_step is
  'Rung on the Return spacing ladder; 0 = never deferred. Reset by Keep.';

-- ─── 3. Notes quiz pool ──────────────────────────────────────────────────────
--
-- The cloze extractor needs whole bodies, and the notes list only carries
-- previews, so the candidates are fetched in one go. Only notes that actually
-- contain an emphasis or highlight span can produce a question, so the filter
-- happens here rather than shipping every note to the browser to be discarded.

create or replace function public.note_quiz_pool(p_limit int default 40)
returns table (
  id          uuid,
  title       text,
  content     text,
  updated_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $note_quiz_pool$
  select n.id, n.title, n.content, n.updated_at
  from public.notes n
  where n.user_id = auth.uid()
    and n.deleted_at is null
    and (n.content like '%**%' or n.content like '%==%')
  order by n.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$note_quiz_pool$;

revoke all on function public.note_quiz_pool(int) from public;
grant execute on function public.note_quiz_pool(int) to authenticated;
