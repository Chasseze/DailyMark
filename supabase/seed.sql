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
