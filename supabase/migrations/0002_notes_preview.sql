-- List rows only need a short plain preview, not the full Markdown body.
-- Keeps the notes library fetch light while the sidebar can still show snippets.

alter table public.notes
  add column if not exists preview text not null default '';

create or replace function public.notes_set_preview()
returns trigger
language plpgsql
as $$
declare
  plain text;
begin
  plain := coalesce(new.content, '');
  -- Light strip of common Markdown markers, then collapse whitespace.
  plain := regexp_replace(plain, E'[*_`#>\\[\\]()!\\\\]', '', 'g');
  plain := regexp_replace(plain, E'\\s+', ' ', 'g');
  plain := trim(both from plain);
  new.preview := left(plain, 320);
  return new;
end;
$$;

drop trigger if exists notes_preview_biu on public.notes;
create trigger notes_preview_biu
  before insert or update of content on public.notes
  for each row
  execute function public.notes_set_preview();

-- Backfill existing rows without rewriting content (trigger only fires on content change).
update public.notes
set preview = left(
  trim(both from regexp_replace(
    regexp_replace(coalesce(content, ''), E'[*_`#>\\[\\]()!\\\\]', '', 'g'),
    E'\\s+',
    ' ',
    'g'
  )),
  320
)
where preview = '' and coalesce(content, '') <> '';
