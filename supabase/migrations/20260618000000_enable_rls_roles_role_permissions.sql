-- Enable Row Level Security on the authorization tables and grant read-only
-- access to authenticated users.
--
-- WHY (critical security finding):
--   public.roles and public.role_permissions had RLS DISABLED, so any holder of
--   the anon key could READ and MODIFY every role and permission assignment —
--   a direct privilege-escalation path. The other 9 public tables already have
--   RLS enabled.
--
-- ACCESS MODEL (verified against the application code):
--   * Reads  — the browser (authenticated staff) reads these tables via
--              AuthContext (current user's capabilities), RolesManager and
--              EmployeesManager. The anon role never reads them.
--   * Writes — only the server-side service-role client writes
--              (createAdminClient in role-actions.ts, gated by requireSuperadmin).
--              service_role BYPASSES RLS, so no write policy is required, and
--              none is granted to anon/authenticated — which is exactly the
--              lock-down we want.
--
-- Result: anon loses all access; authenticated may read but not write; only the
-- superadmin-gated server actions can mutate these tables. Embedded reads
-- (profiles -> roles -> role_permissions) keep working because authenticated
-- retains SELECT. Idempotent — safe to run more than once.

alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "authenticated read roles" on public.roles;
create policy "authenticated read roles"
  on public.roles
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated read role_permissions" on public.role_permissions;
create policy "authenticated read role_permissions"
  on public.role_permissions
  for select
  to authenticated
  using (true);
