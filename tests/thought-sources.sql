\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values
 ('33333333-3333-4333-8333-333333333333','thought-a@example.test'),
 ('44444444-4444-4444-8444-444444444444','thought-b@example.test');
insert into public.thoughts(id,title,content,author,source_name,source_url)
 values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Saved title','Preserved body','Original author','Publication','https://example.com/article');
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
insert into public.thought_bookmarks(user_id,thought_id)
 values(auth.uid(),'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
reset role;
update public.thoughts set content='Changed catalog body' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
set local role authenticated;
do $$ declare nid uuid; again uuid; payload jsonb; backup jsonb; restored integer; before_count integer;
begin
 nid := public.create_thought_version('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 again := public.create_thought_version('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 if nid<>again then raise exception 'Duplicate version created'; end if;
 if (select content from public.notes where id=nid)<>'Preserved body' then raise exception 'Saved source was replaced by newer catalog'; end if;
 update public.notes set content='My own interpretation' where id=nid;
 if (select snapshot->>'content' from public.thought_sources where note_id=nid)<>'Preserved body' then raise exception 'Editing changed the source'; end if;
 begin
   update public.thought_sources set snapshot='{}';
   raise exception 'Source mutation accepted';
 exception when insufficient_privilege then null; end;
 delete from public.thought_bookmarks where thought_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 if not exists(select 1 from public.thought_sources where note_id=nid) then raise exception 'Unsave destroyed writing'; end if;
 insert into public.share_tokens(user_id,token,target_type,note_id) values(auth.uid(),'thought-test-share','note',nid);
 payload := public.get_shared_content('thought-test-share');
 if payload->'thought_source'->'snapshot'->>'author'<>'Original author' or payload->>'content'<>'My own interpretation'
   or payload->'thought_source' ? 'user_id' then raise exception 'Share provenance incorrect'; end if;
 insert into public.share_tokens(user_id,token,target_type,notebook_id)
   select auth.uid(),'thought-test-notebook','notebook',notebook_id from public.notes where id=nid;
 payload := public.get_shared_content('thought-test-notebook');
 if payload->'notes'->0->'thought_source'->'snapshot'->>'author'<>'Original author' then raise exception 'Notebook share lost attribution'; end if;
 backup := jsonb_build_object('format','dailymark','version',2,'notebooks','[]'::jsonb,
   'notes',(select jsonb_agg(to_jsonb(n) || '{"notebook_id":null}'::jsonb) from public.notes n where id=nid),
   'thoughtSources',(select jsonb_agg(to_jsonb(s)) from public.thought_sources s where note_id=nid));
 restored := public.restore_backup(backup);
 if restored<>1 or not exists(select 1 from public.thought_sources s join public.notes n on n.id=s.note_id
   where s.origin='backup' and s.note_id<>nid and s.snapshot->>'content'='Preserved body' and n.content='My own interpretation')
   then raise exception 'Source backup round trip failed'; end if;
 select count(*) into before_count from public.notes;
 begin
   perform public.restore_backup(jsonb_set(backup,'{thoughtSources,0,note_id}','"missing"'::jsonb));
   raise exception 'Invalid source accepted';
 exception when others then if SQLERRM='Invalid source accepted' then raise; end if; end;
 if (select count(*) from public.notes)<>before_count then raise exception 'Failed restore left partial notes'; end if;
 update public.notes set deleted_at=now() where id=nid;
 if public.create_thought_version('dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>nid then raise exception 'Trash bypassed'; end if;
 if public.get_shared_content('thought-test-share') is not null then raise exception 'Trashed adaptation remained shared'; end if;
end $$;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$ declare nid uuid; begin
 if exists(select 1 from public.thought_sources) then raise exception 'Cross-account sources leaked'; end if;
 nid := public.create_thought_version('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 if not exists(select 1 from public.notes where id=nid and user_id=auth.uid() and content='Changed catalog body') then raise exception 'Wrong owner or snapshot'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.create_thought_version(uuid)','execute') then raise exception 'Anonymous adaptation grant'; end if;
 if has_table_privilege('authenticated','public.thought_sources','update') then raise exception 'Client can erase attribution'; end if;
end $$;
rollback;
