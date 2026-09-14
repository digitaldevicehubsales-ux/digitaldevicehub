-- Harden helper functions exposed in the public schema.
-- is_admin only reads JWT claims, so it does not require definer privileges.
alter function public.is_admin() security invoker;

-- handle_new_user is invoked by an auth.users trigger and should not be callable via the public API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
