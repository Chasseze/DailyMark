-- Local development seed (Supabase CLI only; runs after migrations on `supabase db reset`).
--
-- Hosted Supabase automatically grants table/sequence/function privileges to the
-- `anon` and `authenticated` API roles via default privileges, so the migration in
-- migrations/0001_init.sql intentionally does not grant them. The local CLI stack
-- does not fully replicate that for migration-created tables, which otherwise makes
-- every PostgREST request fail with "permission denied for table ...".
--
-- These grants only expose the tables to the API roles; per-user data isolation is
-- still enforced by the row-level security policies defined in the migration.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

-- The blanket grant above runs after the migrations and would hand
-- promote_daily_drops() back to the API roles, undoing the revoke in
-- 0010_daily_drops.sql. It is `security definer` and owns the shared daily
-- feed, so app users must never be able to churn it — locally either.
revoke all on function public.promote_daily_drops(int, boolean) from anon, authenticated;

-- Preserve least privilege after the compatibility grants above.
revoke all on function public.note_backlinks(uuid), public.note_quiz_pool(int), public.search_notes(text), public.restore_backup(jsonb) from public, anon;
revoke all on function public.validate_note_owner(), public.validate_share_owner(), public.capture_note_version(), public.set_updated_at() from public, anon, authenticated;
revoke all on public.note_versions from anon, authenticated;
grant select on public.note_versions to authenticated;

revoke all on function public.note_library_page(text,uuid,text,boolean,boolean,timestamptz,integer,integer) from public, anon;
revoke all on function public.patch_user_prefs(jsonb) from public, anon;
revoke all on function public.claim_push_reminder(uuid,text) from public, anon, authenticated;
