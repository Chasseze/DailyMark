-- Server-side library filtering with a bounded page and exact matching count.
create or replace function public.note_library_page(p_query text default '',p_notebook uuid default null,p_tag text default null,p_trash boolean default false,p_due boolean default false,p_end timestamptz default now(),p_offset integer default 0,p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path = '' as $$
with matches as (
 select n.id,n.user_id,n.notebook_id,n.title,n.preview,n.is_pinned,n.tags,n.deleted_at,n.revisit_at,n.revisit_step,n.created_at,n.updated_at
 from public.notes n where n.user_id=auth.uid()
 and (n.deleted_at is not null)=p_trash
 and (p_notebook is null or n.notebook_id=p_notebook)
 and (p_tag is null or p_tag=any(n.tags))
 and (not p_due or n.revisit_at<=p_end)
 and (p_query='' or n.search_vector @@ websearch_to_tsquery('english',left(p_query,500)))
), page as (select * from matches order by is_pinned desc,updated_at desc,id offset greatest(0,p_offset) limit least(100,greatest(1,p_limit)))
select jsonb_build_object('total',(select count(*) from matches),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb));
$$;
revoke all on function public.note_library_page(text,uuid,text,boolean,boolean,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function public.note_library_page(text,uuid,text,boolean,boolean,timestamptz,integer,integer) to authenticated;
