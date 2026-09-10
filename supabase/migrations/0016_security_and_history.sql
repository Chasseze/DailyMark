-- Enforce ownership at every boundary, including definer functions.
begin;
create or replace function public.validate_note_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.notebook_id is not null and not exists (
    select 1 from public.notebooks where id = new.notebook_id and user_id = new.user_id
  ) then raise exception 'Notebook is not available' using errcode = '42501'; end if;
  if TG_OP = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Ownership cannot change' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger notes_validate_owner before insert or update on public.notes
for each row execute function public.validate_note_owner();

create or replace function public.validate_share_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.target_type = 'note' and not exists (
    select 1 from public.notes where id = new.note_id and user_id = new.user_id and deleted_at is null
  )) or (new.target_type = 'notebook' and not exists (
    select 1 from public.notebooks where id = new.notebook_id and user_id = new.user_id
  )) then raise exception 'Share target is not available' using errcode = '42501'; end if;
  return new;
end $$;
create trigger shares_validate_owner before insert or update on public.share_tokens
for each row execute function public.validate_share_owner();
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
      and n.user_id = share.user_id
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
  where nb.id = share.notebook_id and nb.user_id = share.user_id;

  return payload;
end;
$$;

grant execute on function public.get_shared_content(text) to anon, authenticated;

revoke all on function public.get_shared_content(text) from public, anon, authenticated;
grant execute on function public.get_shared_content(text) to anon, authenticated;

-- Previously uploaded bytes become private without moving their paths.
update storage.buckets set public = false where id = 'note-images';
drop policy if exists "note images: select" on storage.objects;
create policy "note images: select" on storage.objects for select to authenticated
using (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "note images: insert" on storage.objects;
create policy "note images: insert" on storage.objects for insert to authenticated
with check (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]
  and exists(select 1 from public.notes n where n.id::text = (storage.foldername(name))[2]
    and n.user_id = auth.uid() and n.deleted_at is null));

-- A previous snapshot is captured transactionally for every meaningful edit.
create table public.note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index note_versions_history on public.note_versions(note_id, created_at desc);
alter table public.note_versions enable row level security;
create policy "own versions read" on public.note_versions for select to authenticated using (auth.uid() = user_id);
revoke all on public.note_versions from anon, authenticated;
grant select on public.note_versions to authenticated;
create or replace function public.capture_note_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (old.title, old.content, old.tags, old.notebook_id) is distinct from
     (new.title, new.content, new.tags, new.notebook_id) then
    insert into public.note_versions(note_id,user_id,snapshot) values(old.id,old.user_id,to_jsonb(old));
    delete from public.note_versions where note_id=old.id and id in (
      select id from public.note_versions where note_id=old.id order by created_at desc,id desc offset 50
    );
  end if;
  return new;
end $$;
create trigger notes_capture_version before update on public.notes
for each row execute function public.capture_note_version();

-- Server-owned timestamp is a reliable optimistic concurrency token even in a transaction.
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end $$;

revoke all on function public.validate_note_owner() from public, anon, authenticated;
revoke all on function public.validate_share_owner() from public, anon, authenticated;
revoke all on function public.capture_note_version() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.search_notes(text) from public, anon;
grant execute on function public.search_notes(text) to authenticated;
commit;
