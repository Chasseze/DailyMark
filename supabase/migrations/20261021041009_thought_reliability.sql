begin;

-- These triggers use only pg_catalog built-ins. Do not resolve functions from
-- caller-controlled schemas when maintaining previews and search indexes.
alter function public.notes_set_preview() set search_path = '';
alter function public.notes_set_search_vector() set search_path = '';
alter function public.thoughts_set_preview() set search_path = '';
alter function public.visuals_set_preview() set search_path = '';

-- Membership belongs to the user's preserved copy, not the shared catalog's
-- lifetime. The capture trigger below still rejects unknown/unpreserved IDs.
alter table public.thought_bookmarks
  drop constraint thought_bookmarks_thought_id_fkey;

create or replace function private.capture_thought_source() returns trigger
language plpgsql security definer set search_path = '' as $$
declare original public.thoughts;
begin
  -- Hold the original until this transaction commits, so removal cannot race
  -- a first save and leave a bookmark with no source copy.
  select * into original from public.thoughts where id=new.thought_id for key share;
  if found then
    insert into public.thought_sources(user_id,thought_id,snapshot)
      values(new.user_id,original.id,to_jsonb(original))
      on conflict (user_id,thought_id) where origin='catalog' do nothing;
  elsif not exists(select 1 from public.thought_sources
    where user_id=new.user_id and thought_id=new.thought_id) then
    raise exception 'Thought is not available' using errcode='23503';
  end if;
  return new;
end $$;

-- A restored preserved source can also be personalized after catalog removal.
-- Lock one owned source and reuse its note; do not relabel imported provenance.
create or replace function public.create_thought_version(p_thought_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); source public.thought_sources; nid uuid;
begin
  if uid is null then raise exception 'Sign in to personalize a thought' using errcode='42501'; end if;
  insert into public.thought_sources(user_id,thought_id,snapshot)
    select uid,t.id,to_jsonb(t) from public.thoughts t where t.id=p_thought_id
    on conflict (user_id,thought_id) where origin='catalog' do nothing;
  select * into source from public.thought_sources
    where user_id=uid and thought_id=p_thought_id
    order by (origin='catalog') desc,captured_at desc,id limit 1 for update;
  if not found then raise exception 'Thought is not available'; end if;
  if source.note_id is not null then return source.note_id; end if;
  insert into public.thought_bookmarks(user_id,thought_id) values(uid,p_thought_id) on conflict do nothing;
  insert into public.notes(user_id,notebook_id,title,content,tags)
    values(uid,(select id from public.notebooks where user_id=uid and lower(name)='inbox' limit 1),
      source.snapshot->>'title',source.snapshot->>'content',array['from-thought']) returning id into nid;
  update public.thought_sources set note_id=nid where id=source.id;
  return nid;
end $$;

-- One SQL statement builds every related array under one MVCC snapshot.
-- Return JSON rather than a rowset so PostgREST's row cap cannot truncate it.
create function public.export_backup() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare payload jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select jsonb_build_object(
    'format','dailymark','version',2,'createdAt',now(),
    'notebooks',coalesce((select jsonb_agg(to_jsonb(n) order by n.id) from public.notebooks n where n.user_id=auth.uid()),'[]'::jsonb),
    'notes',coalesce((select jsonb_agg(to_jsonb(n) order by n.id) from public.notes n where n.user_id=auth.uid()),'[]'::jsonb),
    'thoughtSources',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.thought_sources s where s.user_id=auth.uid()),'[]'::jsonb)
  ) into payload;
  if jsonb_array_length(payload->'notes')>100000 or jsonb_array_length(payload->'thoughtSources')>100000
    then raise exception 'This account exceeds the backup size limit'; end if;
  return payload;
end $$;
revoke all on function public.export_backup() from public,anon,authenticated;
grant execute on function public.export_backup() to authenticated;
commit;
