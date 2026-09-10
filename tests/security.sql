\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','security-a@example.test'),('22222222-2222-4222-8222-222222222222','security-b@example.test');
insert into public.notes(id,user_id,title,content) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','A','Private A'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','B','Private B');
insert into public.notebooks(id,user_id,name) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222','B notebook');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if exists(select 1 from public.notes where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then raise exception 'Cross-account read leaked'; end if;
 begin
  insert into public.share_tokens(user_id,token,target_type,note_id) values(auth.uid(),'malicious-note-token','note','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Foreign share accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.share_tokens(user_id,token,target_type,notebook_id) values(auth.uid(),'malicious-book-token','notebook','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  raise exception 'Foreign notebook share accepted';
 exception when insufficient_privilege then null; end;
 begin
  update public.notes set notebook_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  raise exception 'Foreign notebook attachment accepted';
 exception when insufficient_privilege then null; end;
end $$;
-- A stale revision update must change zero rows.
do $$ declare revision timestamptz; affected integer; begin
 select updated_at into revision from public.notes where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 update public.notes set content='New A' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and updated_at=revision;
 update public.notes set content='STALE' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and updated_at=revision;
 get diagnostics affected = row_count;
 if affected<>0 then raise exception 'Stale write accepted'; end if;
 if not exists(select 1 from public.note_versions where note_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and snapshot->>'content'='Private A') then raise exception 'History missing'; end if;
end $$;
-- Restore fails atomically when one note references an absent notebook.
do $$ declare before_count integer; after_count integer; begin
 select count(*) into before_count from public.notes;
 begin
 perform public.restore_backup('{"format":"dailymark","version":1,"notebooks":[],"notes":[{"title":"valid","content":"one","tags":[]},{"title":"invalid","content":"two","tags":[],"notebook_id":"missing"}]}'::jsonb);
 raise exception 'Invalid restore accepted';
 exception when others then
  if SQLERRM = 'Invalid restore accepted' then raise; end if;
 end;
 select count(*) into after_count from public.notes;
 if before_count<>after_count then raise exception 'Partial restore remained'; end if;
end $$;
-- Round-trip note boundaries and tags.
do $$ declare restored integer; begin
 restored := public.restore_backup('{"format":"dailymark","version":1,"notebooks":[],"notes":[{"title":"First","content":"one","tags":["tag"]},{"title":"Second","content":"two","tags":[]}]}'::jsonb);
 if restored<>2 or not exists(select 1 from public.notes where title='First' and tags=array['tag']) then raise exception 'Restore round trip failed'; end if;
end $$;
reset role;
do $$ begin
 if (select public from storage.buckets where id='note-images') then raise exception 'Image bucket still public'; end if;
 if has_function_privilege('anon','public.restore_backup(jsonb)','execute') then raise exception 'Anonymous restore grant'; end if;
 if has_function_privilege('anon','public.promote_daily_drops(integer,boolean)','execute') then raise exception 'Anonymous promotion grant'; end if;
end $$;
rollback;
