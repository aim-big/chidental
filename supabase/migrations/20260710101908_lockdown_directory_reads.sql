-- Lock down the staff directory + role/permission matrix, and fix a broken
-- is_admin(). Paired with the app change that moves the Employees/Roles reads to
-- gated service-role server actions (they no longer read from the browser).

-- 1) Fix is_admin(): its body still referenced profiles.role — a column dropped
--    when staff roles moved to profiles.role_id + a roles table. Every call
--    therefore errored (fail-closed, but a latent landmine, and it gates the
--    profiles INSERT/UPDATE/DELETE policies). Rewrite against role_id ->
--    roles.is_system (the built-in Super Admin), preserving the original intent.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.active and r.is_system
  );
$$;

-- 2) profiles/roles/role_permissions had `USING (true)` SELECT policies for the
--    `authenticated` role, so any signed-in user could enumerate every staff
--    member's name + username (the login identifier) and the whole role→
--    permission map, flagging the Super Admin. With PIN-based auth that is useful
--    recon for a targeted brute force. Restrict the browser to reading ONLY its
--    own profile, its own role, and that role's permissions. The admin screens
--    read the full set via service-role server actions (RLS-exempt); the API
--    already uses service-role. `(select auth.uid())` is wrapped so Postgres
--    caches it as an initplan (per-statement, not per-row).
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "authenticated read roles" on public.roles;
create policy roles_select_own on public.roles
  for select to authenticated
  using (id in (select p.role_id from public.profiles p where p.id = (select auth.uid())));

drop policy if exists "authenticated read role_permissions" on public.role_permissions;
create policy role_permissions_select_own on public.role_permissions
  for select to authenticated
  using (role_id in (select p.role_id from public.profiles p where p.id = (select auth.uid())));
