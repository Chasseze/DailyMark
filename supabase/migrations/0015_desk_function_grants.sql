-- Close the anon EXECUTE grant on the 0014 desk functions.
-- This file is PostgreSQL only. Paste the entire contents into the Supabase
-- SQL editor (SQL, not a .tsx file).
--
-- 0014 revoked note_backlinks() and note_quiz_pool() from PUBLIC and granted
-- them to `authenticated`, which reads like it locks anon out. It does not.
-- Hosted Supabase ships
--
--   alter default privileges in schema public
--     grant execute on functions to anon, authenticated;
--
-- so every new function in `public` is granted to the `anon` role by name at
-- creation. `revoke ... from public` drops the implicit PUBLIC grant and leaves
-- that named one untouched — PUBLIC and the `anon` role are not the same thing.
-- Confirmed against the hosted project: both functions answered the anon key
-- with `200 []` rather than a permission error.
--
-- Nothing leaked. Both are `security invoker` and filter on auth.uid(), which
-- is null for anon, so RLS on notes and the explicit user_id filter each
-- independently return zero rows — which is exactly why the answer was an empty
-- array. This is unnecessary surface, not exposure.
--
-- 0010_daily_drops.sql already had this right: it names the roles in the
-- revoke. That is the pattern to copy, and it is what this file applies.

revoke all on function public.note_backlinks(uuid) from public;
revoke all on function public.note_backlinks(uuid) from anon, authenticated;
grant execute on function public.note_backlinks(uuid) to authenticated;

revoke all on function public.note_quiz_pool(int) from public;
revoke all on function public.note_quiz_pool(int) from anon, authenticated;
grant execute on function public.note_quiz_pool(int) to authenticated;
