create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<4096 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-zA-Z0-9.-]+\.notify.windows.com)/'),
 p256dh text not null check(length(p256dh) between 20 and 300),
 auth text not null check(length(auth) between 10 and 100),
 timezone text not null default 'UTC' check(length(timezone)<100),
 last_sent_day text,
 created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.push_subscriptions from public,anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
-- Only the server scheduler can reserve a daily send.
create or replace function public.claim_push_reminder(p_id uuid,p_day text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
 update public.push_subscriptions set last_sent_day=p_day where id=p_id and last_sent_day is distinct from p_day;
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke all on function public.claim_push_reminder(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_push_reminder(uuid,text) to service_role;
grant all on public.push_subscriptions to service_role;

create index push_subscriptions_owner on public.push_subscriptions(user_id);
