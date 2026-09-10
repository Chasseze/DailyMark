-- A restore is atomic and creates fresh IDs; it never overwrites existing notes.
create or replace function public.restore_backup(p_backup jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; mapping jsonb := '{}'::jsonb; new_id uuid; count_notes integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_backup->>'format' is distinct from 'dailymark' or p_backup->>'version' is distinct from '1'
    or jsonb_typeof(p_backup->'notes') is distinct from 'array'
    or jsonb_typeof(p_backup->'notebooks') is distinct from 'array'
    or jsonb_array_length(p_backup->'notes') > 100000 then raise exception 'Invalid backup'; end if;
  for item in select * from jsonb_array_elements(p_backup->'notebooks') loop
    insert into public.notebooks(user_id,name,color) values(auth.uid(),item->>'name',item->>'color') returning id into new_id;
    mapping := mapping || jsonb_build_object(item->>'id',new_id);
  end loop;
  for item in select * from jsonb_array_elements(p_backup->'notes') loop
    if item->>'notebook_id' is not null and not mapping ? (item->>'notebook_id') then raise exception 'Missing notebook'; end if;
    insert into public.notes(user_id,notebook_id,title,content,tags,is_pinned,deleted_at,revisit_at,revisit_step)
    values(auth.uid(),(mapping->>(item->>'notebook_id'))::uuid,item->>'title',item->>'content',
      array(select jsonb_array_elements_text(item->'tags')),coalesce((item->>'is_pinned')::boolean,false),
      (item->>'deleted_at')::timestamptz,(item->>'revisit_at')::timestamptz,coalesce((item->>'revisit_step')::smallint,0));
    count_notes := count_notes + 1;
  end loop;
  return count_notes;
end $$;
revoke all on function public.restore_backup(jsonb) from public, anon, authenticated;
grant execute on function public.restore_backup(jsonb) to authenticated;
