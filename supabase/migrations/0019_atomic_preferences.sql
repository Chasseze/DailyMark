create or replace function public.patch_user_prefs(p_patch jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
 if auth.uid() is null or jsonb_typeof(p_patch)<>'object' or octet_length(p_patch::text)>20000 then raise exception 'Invalid preferences'; end if;
 update public.profiles set prefs = prefs || (p_patch - 'speech' - 'reminder')
  || case when p_patch ? 'speech' then jsonb_build_object('speech',coalesce(prefs->'speech','{}'::jsonb)||(p_patch->'speech')) else '{}'::jsonb end
  || case when p_patch ? 'reminder' then jsonb_build_object('reminder',coalesce(prefs->'reminder','{}'::jsonb)||(p_patch->'reminder')) else '{}'::jsonb end
 where id=auth.uid();
 if not found then raise exception 'Profile unavailable'; end if;
end $$;
revoke all on function public.patch_user_prefs(jsonb) from public,anon,authenticated;
grant execute on function public.patch_user_prefs(jsonb) to authenticated;
