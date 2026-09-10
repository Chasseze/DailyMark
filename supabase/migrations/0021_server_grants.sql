-- Explicit server grants for installations that no longer auto-expose objects.
-- service_role is server-only; it must never be included in the frontend build.
grant select on public.share_tokens, public.profiles to service_role;
grant select, update on public.notes to service_role;
grant execute on function public.get_shared_content(text) to service_role;
