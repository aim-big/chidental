-- Security-linter hardening (Supabase advisors). Two safe, behavior-preserving fixes.
--
-- 1) sync_invoice_amount_paid() is a SECURITY DEFINER *trigger* function
--    (fired by payments_sync_invoice_amount_paid). It is never meant to be called
--    as a PostgREST RPC, but by default PUBLIC could execute it via /rest/v1/rpc.
--    Trigger execution does NOT require the invoking role to hold EXECUTE, so
--    revoking it from the API roles is safe and closes the anon-callable surface.
--    (Advisor 0028 anon_security_definer_function_executable.)
revoke execute on function public.sync_invoice_amount_paid() from public, anon, authenticated;

-- 2) prevent_invoice_activity_mutation() had a role-mutable search_path. It only
--    RAISEs (no object references), so pinning search_path is pure hardening with
--    no behavior change. (Advisor 0011 function_search_path_mutable.)
alter function public.prevent_invoice_activity_mutation() set search_path = '';

-- NOTE — intentionally NOT changed (documented so future audits don't "fix" them):
--   * is_admin() / auth_has_permission() stay executable by `authenticated`: they are
--     invoked inside RLS policies, which run as the querying role, so revoking EXECUTE
--     would break access control.
--   * admin_audit_log / invoice_activity_log keep RLS-enabled-with-no-policy: that is a
--     deliberate deny-all to clients; only the service role reads/writes them.
--   * Auth leaked-password protection stays OFF: PINs are 6-digit, so HaveIBeenPwned
--     would reject nearly every valid PIN and break staff login.
