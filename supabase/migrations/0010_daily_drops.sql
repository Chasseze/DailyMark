-- Daily drops: a real, scheduled content pipeline for Thoughts and Visuals.
--
-- Before this migration there was no ingestion at all. `published_at` was
-- rewritten in the browser on every page load (see the old prepareCatalog in
-- ThoughtsContext / VisualsContext), which meant:
--   * nothing was ever genuinely "new" — the same rows were relabelled;
--   * the same row reported a different published_at on every visit;
--   * the refill only fired when the feed hit ZERO, so a single surviving row
--     froze the shelf (with 0007's 2-day spacing vs a 2-day live window that
--     left exactly one live thought for a full 48 hours).
--
-- Now the database owns `published_at`. A scheduled job promotes exactly
-- DROPS_PER_DAY rows per tab each day, regardless of how many are currently
-- live. A promoted row stays live for LIVE_MAX_AGE_DAYS (2) — the client
-- enforces that window — and bookmarked rows are kept by the *_bookmarks
-- tables, so saving still rescues a piece after it drops off.
--
-- Rows are promoted least-recently-published first, so the catalog rotates
-- fairly. Adding more curated rows to `thoughts` / `visuals` automatically
-- lengthens the cycle before anything repeats — that is the content lever.

-- ─── Run log: makes the daily job idempotent ─────────────────────────────────
-- Without this, a double-fire (cron retry, manual invocation) would burn
-- through the pool twice in one day.

create table if not exists public.daily_drop_runs (
  run_date date not null,
  kind     text not null check (kind in ('thoughts', 'visuals')),
  promoted int  not null default 0,
  ran_at   timestamptz not null default now(),
  primary key (run_date, kind)
);

-- No policies: only the security-definer function below touches this table.
alter table public.daily_drop_runs enable row level security;

-- ─── The promotion job ───────────────────────────────────────────────────────

create or replace function public.promote_daily_drops(
  p_count int default 3,
  p_force boolean default false
)
-- NB: the OUT parameters are deliberately *not* named `kind` / `promoted`.
-- PL/pgSQL resolves OUT params ahead of column names, so those names would
-- make `on conflict (run_date, kind)` below ambiguous and the function would
-- fail at call time (only on the branch that actually promotes).
returns table (feed_kind text, drops_promoted int)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  -- Must match LIVE_MAX_AGE_DAYS in src/lib/{thoughts,visuals}-rotation.ts.
  v_live_days constant int := 2;
  v_promoted  int;
  v_already   boolean;
begin
  if p_count < 1 then
    raise exception 'p_count must be >= 1';
  end if;

  -- ---------------- Thoughts ----------------
  select exists (
    select 1 from public.daily_drop_runs r
    where r.run_date = current_date and r.kind = 'thoughts'
  ) into v_already;

  v_promoted := 0;
  if p_force or not v_already then
    -- Pick the least-recently-published rows that are NOT already on the live
    -- shelf, so a drop always surfaces something the reader has not just seen.
    with candidates as (
      select t.id
      from public.thoughts t
      where t.published_at <= now() - make_interval(days => v_live_days)
      order by t.published_at asc, t.id asc
      limit p_count
    )
    update public.thoughts t
    set published_at = now()
    from candidates c
    where t.id = c.id;

    get diagnostics v_promoted = row_count;

    insert into public.daily_drop_runs (run_date, kind, promoted)
    values (current_date, 'thoughts', v_promoted)
    on conflict (run_date, kind)
      do update set promoted = public.daily_drop_runs.promoted + excluded.promoted,
                    ran_at = now();
  end if;

  feed_kind := 'thoughts';
  drops_promoted := v_promoted;
  return next;

  -- ---------------- Visuals ----------------
  select exists (
    select 1 from public.daily_drop_runs r
    where r.run_date = current_date and r.kind = 'visuals'
  ) into v_already;

  v_promoted := 0;
  if p_force or not v_already then
    with candidates as (
      select v.id
      from public.visuals v
      where v.published_at <= now() - make_interval(days => v_live_days)
      order by v.published_at asc, v.id asc
      limit p_count
    )
    update public.visuals v
    set published_at = now()
    from candidates c
    where v.id = c.id;

    get diagnostics v_promoted = row_count;

    insert into public.daily_drop_runs (run_date, kind, promoted)
    values (current_date, 'visuals', v_promoted)
    on conflict (run_date, kind)
      do update set promoted = public.daily_drop_runs.promoted + excluded.promoted,
                    ran_at = now();
  end if;

  feed_kind := 'visuals';
  drops_promoted := v_promoted;
  return next;

  return;
end;
$fn$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. This function
-- mutates the shared catalog, so lock it down: only the scheduler and backend
-- roles may run it. App users must never be able to churn the feed.
revoke all on function public.promote_daily_drops(int, boolean) from public;
revoke all on function public.promote_daily_drops(int, boolean) from anon, authenticated;
grant execute on function public.promote_daily_drops(int, boolean) to postgres, service_role;

-- ─── Bootstrap: give both tabs a full, correctly-staggered shelf right now ───
-- 3 rows dated today and 3 dated yesterday => 6 live immediately, and they
-- expire on different days instead of all at once.

with ordered as (
  select id, row_number() over (order by published_at desc, id asc) as rn
  from public.thoughts
)
update public.thoughts t
set published_at = case when o.rn <= 3 then now() else now() - interval '1 day' end
from ordered o
where t.id = o.id and o.rn <= 6;

with ordered as (
  select id, row_number() over (order by published_at desc, id asc) as rn
  from public.visuals
)
update public.visuals v
set published_at = case when o.rn <= 3 then now() else now() - interval '1 day' end
from ordered o
where v.id = o.id and o.rn <= 6;

-- Record today's run so the scheduled job does not immediately promote again
-- on top of the bootstrap.
insert into public.daily_drop_runs (run_date, kind, promoted)
values (current_date, 'thoughts', 3), (current_date, 'visuals', 3)
on conflict (run_date, kind) do nothing;

-- ─── Schedule it ─────────────────────────────────────────────────────────────
-- Wrapped so the migration still applies cleanly on a project where pg_cron
-- cannot be enabled from SQL; the function above remains callable from the
-- dashboard, the CLI, or any external scheduler in that case.

do $sched$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  raise notice 'pg_cron extension unavailable (%). Schedule promote_daily_drops() manually.', sqlerrm;
end
$sched$;

do $sched$
begin
  -- Re-running this migration should not stack duplicate schedules.
  begin
    perform cron.unschedule('dailymark-daily-drops');
  exception when others then
    null;
  end;

  -- 06:00 UTC daily.
  perform cron.schedule(
    'dailymark-daily-drops',
    '0 6 * * *',
    'select public.promote_daily_drops(3);'
  );
exception when others then
  raise notice 'Could not schedule via pg_cron (%). Run: select public.promote_daily_drops(3); daily.', sqlerrm;
end
$sched$;
