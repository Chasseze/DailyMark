begin;

-- Saved sources outlive bookmarks and catalog changes. Only controlled database
-- operations may capture a source or attach a note; users cannot erase credits.
create table public.thought_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thought_id uuid not null,
  note_id uuid unique references public.notes(id) on delete set null,
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object' and
    snapshot ?& array['title','content','author','source_name','source_url'] and
    jsonb_typeof(snapshot->'title') = 'string' and
    jsonb_typeof(snapshot->'content') = 'string' and
    jsonb_typeof(snapshot->'author') = 'string' and
    jsonb_typeof(snapshot->'source_name') = 'string' and
    jsonb_typeof(snapshot->'source_url') = 'string' and
    snapshot ?& array['id','preview','collection','tags','published_at','created_at'] and
    snapshot->>'id' = thought_id::text and
    jsonb_typeof(snapshot->'preview') = 'string' and
    jsonb_typeof(snapshot->'collection') = 'string' and
    jsonb_typeof(snapshot->'tags') = 'array' and
    not jsonb_path_exists(snapshot, '$.tags[*] ? (@.type() != "string")') and
    jsonb_typeof(snapshot->'published_at') = 'string' and
    jsonb_typeof(snapshot->'created_at') = 'string'
  ),
  captured_at timestamptz not null default now(),
  origin text not null default 'catalog' check (origin in ('catalog', 'backup'))
);
create unique index thought_sources_primary on public.thought_sources(user_id, thought_id)
  where origin = 'catalog';
create index thought_sources_user on public.thought_sources(user_id);
alter table public.thought_sources enable row level security;
create policy "own thought sources read" on public.thought_sources
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.thought_sources from public, anon, authenticated;
grant select on public.thought_sources to authenticated;

create schema if not exists private;
create function private.capture_thought_source() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.thought_sources(user_id,thought_id,snapshot)
    select new.user_id,t.id,to_jsonb(t) from public.thoughts t where t.id = new.thought_id
    on conflict (user_id,thought_id) where origin = 'catalog' do nothing;
  return new;
end $$;
revoke all on function private.capture_thought_source() from public, anon, authenticated;
create trigger bookmarks_capture_source after insert on public.thought_bookmarks
  for each row execute function private.capture_thought_source();

-- Older bookmarks have no historical body. Capture today's catalog, and date
-- the capture honestly rather than claiming it was preserved on bookmark day.
insert into public.thought_sources(user_id,thought_id,snapshot)
  select b.user_id,t.id,to_jsonb(t) from public.thought_bookmarks b
  join public.thoughts t on t.id = b.thought_id;

-- This intentionally privileged operation writes the protected attribution.
-- It accepts no owner, content, source or note ID from the client. The row lock
-- makes concurrent taps/retries return the same personal note.
create function public.create_thought_version(p_thought_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  source public.thought_sources;
  nid uuid;
begin
  if uid is null then raise exception 'Sign in to personalize a thought' using errcode='42501'; end if;
  insert into public.thought_sources(user_id,thought_id,snapshot)
    select uid,t.id,to_jsonb(t) from public.thoughts t where t.id=p_thought_id
    on conflict (user_id,thought_id) where origin='catalog' do nothing;
  select * into source from public.thought_sources
    where user_id=uid and thought_id=p_thought_id and origin='catalog' for update;
  if not found then raise exception 'Thought is not available'; end if;
  if source.note_id is not null then return source.note_id; end if;
  -- Existing catalog rows can still be bookmarked; a preserved source may also
  -- remain accessible after its catalog row has been removed.
  insert into public.thought_bookmarks(user_id,thought_id)
    select uid,id from public.thoughts where id=p_thought_id on conflict do nothing;
  insert into public.notes(user_id,notebook_id,title,content,tags)
    values(uid,(select id from public.notebooks where user_id=uid and lower(name)='inbox' limit 1),
      source.snapshot->>'title',source.snapshot->>'content',
      array['from-thought']) returning id into nid;
  update public.thought_sources set note_id=nid where id=source.id;
  return nid;
end $$;
revoke all on function public.create_thought_version(uuid) from public, anon, authenticated;
grant execute on function public.create_thought_version(uuid) to authenticated;

-- Share only provenance attached to an authorized share target, never account
-- identifiers or unrelated private sources.
create function private.note_source_payload(p_note_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('snapshot',s.snapshot,'captured_at',s.captured_at,'origin',s.origin)
    from public.thought_sources s where s.note_id=p_note_id;
$$;
revoke all on function private.note_source_payload(uuid) from public, anon, authenticated;

create or replace function public.get_shared_content(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare share public.share_tokens; payload jsonb;
begin
  select * into share from public.share_tokens where token=p_token and revoked_at is null
    and (expires_at is null or expires_at>now());
  if not found then return null; end if;
  if share.target_type='note' then
    select jsonb_build_object('type','note','title',n.title,'content',n.content,'tags',n.tags,
      'shared_at',share.created_at,'thought_source',private.note_source_payload(n.id)) into payload
      from public.notes n where n.id=share.note_id and n.user_id=share.user_id and n.deleted_at is null;
  else
    select jsonb_build_object('type','notebook','title',nb.name,'shared_at',share.created_at,
      'notes',coalesce((select jsonb_agg(jsonb_build_object('title',n.title,'content',n.content,
        'tags',n.tags,'updated_at',n.updated_at,'thought_source',private.note_source_payload(n.id))
        order by n.is_pinned desc,n.updated_at desc) from public.notes n
        where n.notebook_id=nb.id and n.user_id=share.user_id and n.deleted_at is null),'[]'::jsonb))
      into payload from public.notebooks nb where nb.id=share.notebook_id and nb.user_id=share.user_id;
  end if;
  return payload;
end $$;

-- Backups v2 include source records. v1 remains supported. Fresh IDs and a
-- separate 'backup' origin preserve attribution without replacing a live copy.
create or replace function public.restore_backup(p_backup jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); item jsonb; mapping jsonb := '{}'::jsonb;
  note_mapping jsonb := '{}'::jsonb; new_id uuid; count_notes integer := 0;
begin
  if uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if p_backup->>'format' is distinct from 'dailymark' or
    (p_backup->>'version') is null or p_backup->>'version' not in ('1','2') or
    jsonb_typeof(p_backup->'notes') is distinct from 'array' or
    jsonb_typeof(p_backup->'notebooks') is distinct from 'array' or
    jsonb_array_length(p_backup->'notes')>100000 then raise exception 'Invalid backup'; end if;
  if p_backup->>'version'='2' and jsonb_typeof(p_backup->'thoughtSources') is distinct from 'array'
    then raise exception 'Missing thought sources'; end if;
  for item in select * from jsonb_array_elements(p_backup->'notebooks') loop
    if mapping ? (item->>'id') then raise exception 'Duplicate notebook'; end if;
    insert into public.notebooks(user_id,name,color) values(uid,item->>'name',item->>'color') returning id into new_id;
    mapping := mapping || jsonb_build_object(item->>'id',new_id);
  end loop;
  for item in select * from jsonb_array_elements(p_backup->'notes') loop
    if note_mapping ? (item->>'id') then raise exception 'Duplicate note'; end if;
    if item->>'notebook_id' is not null and not mapping ? (item->>'notebook_id') then raise exception 'Missing notebook'; end if;
    insert into public.notes(user_id,notebook_id,title,content,tags,is_pinned,deleted_at,revisit_at,revisit_step)
      values(uid,(mapping->>(item->>'notebook_id'))::uuid,item->>'title',item->>'content',
        array(select jsonb_array_elements_text(item->'tags')),coalesce((item->>'is_pinned')::boolean,false),
        (item->>'deleted_at')::timestamptz,(item->>'revisit_at')::timestamptz,coalesce((item->>'revisit_step')::smallint,0))
      returning id into new_id;
    if item->>'id' is not null then
      note_mapping := note_mapping || jsonb_build_object(item->>'id',new_id);
    elsif p_backup->>'version'='2' then raise exception 'Missing note ID'; end if;
    count_notes := count_notes+1;
  end loop;
  if p_backup->>'version'='2' then
    for item in select * from jsonb_array_elements(p_backup->'thoughtSources') loop
      if item->>'note_id' is not null and not note_mapping ? (item->>'note_id') then raise exception 'Missing source note'; end if;
      insert into public.thought_sources(user_id,thought_id,note_id,snapshot,captured_at,origin)
        values(uid,(item->>'thought_id')::uuid,(note_mapping->>(item->>'note_id'))::uuid,
          item->'snapshot',(item->>'captured_at')::timestamptz,'backup');
    end loop;
  end if;
  return count_notes;
end $$;
revoke all on function public.restore_backup(jsonb) from public, anon, authenticated;
grant execute on function public.restore_backup(jsonb) to authenticated;
commit;
