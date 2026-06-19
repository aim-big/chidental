-- Spec 5 — Security: permission-enforcing RLS + function hardening.
--
-- Closes the "any authenticated user can write directly to the PostgREST API,
-- bypassing the UI/server-action permission checks" hole. Business-table WRITES
-- now require the same permission the UI/actions check, enforced in the database
-- via auth_has_permission(). Reads stay broad for authenticated (trusted-staff
-- deployment; read-gating intentionally deferred). Server actions use the
-- service_role client, which bypasses RLS and remains code-gated by
-- requirePermission(); SECURITY DEFINER triggers also bypass RLS.

-- 1) Permission helper — mirrors src/domain/permissions.ts `permissionGranted`:
--    an active profile whose role is super-admin (is_system) OR holds the perm.
create or replace function public.auth_has_permission(p_perm text)
returns boolean
language sql
security definer
stable
set search_path to 'public'
as $$
  select exists (
    select 1
    from profiles pr
    join roles r on r.id = pr.role_id
    where pr.id = auth.uid()
      and pr.active
      and (
        r.is_system
        or exists (
          select 1 from role_permissions rp
          where rp.role_id = r.id and rp.permission = p_perm
        )
      )
  );
$$;
revoke execute on function public.auth_has_permission(text) from anon, public;
grant execute on function public.auth_has_permission(text) to authenticated;

-- 2) Replace the permissive `authenticated_all` policies with read-broad,
--    write-gated policies. (SELECT USING (true) is intentional public-to-staff
--    read; the FOR ALL write policy carries the permission check.)

drop policy if exists authenticated_all on public.customers;
create policy customers_read  on public.customers for select to authenticated using (true);
create policy customers_write on public.customers for all to authenticated
  using (public.auth_has_permission('customers.edit'))
  with check (public.auth_has_permission('customers.edit'));

drop policy if exists authenticated_all on public.products;
create policy products_read  on public.products for select to authenticated using (true);
create policy products_write on public.products for all to authenticated
  using (public.auth_has_permission('products.edit'))
  with check (public.auth_has_permission('products.edit'));

drop policy if exists authenticated_all on public.service_statuses;
create policy service_statuses_read  on public.service_statuses for select to authenticated using (true);
create policy service_statuses_write on public.service_statuses for all to authenticated
  using (public.auth_has_permission('services.edit'))
  with check (public.auth_has_permission('services.edit'));

drop policy if exists authenticated_all on public.work_stages;
create policy work_stages_read  on public.work_stages for select to authenticated using (true);
create policy work_stages_write on public.work_stages for all to authenticated
  using (public.auth_has_permission('settings.manage'))
  with check (public.auth_has_permission('settings.manage'));

-- invoice_items: reads broad. The ONLY session-client write is the work-status
-- update (updateWorkStatusAction, gated invoices.view). INSERT/DELETE happen
-- only via the service_role RPCs (create/update_invoice_with_items). Column
-- privileges further restrict authenticated UPDATE to the work-status columns,
-- so a view-only user cannot alter price/qty/description via a direct API call.
drop policy if exists authenticated_all on public.invoice_items;
create policy invoice_items_read   on public.invoice_items for select to authenticated using (true);
create policy invoice_items_update on public.invoice_items for update to authenticated
  using (public.auth_has_permission('invoices.view'))
  with check (public.auth_has_permission('invoices.view'));
revoke update on public.invoice_items from authenticated;
grant update (work_status, stage_id, resume_status) on public.invoice_items to authenticated;

-- invoices / payments / history: NO authenticated writes. All writes go through
-- the service_role client (server actions, RLS-bypassing + code-gated); the
-- history row is written by a SECURITY DEFINER trigger.
drop policy if exists authenticated_all on public.invoices;
create policy invoices_read on public.invoices for select to authenticated using (true);

drop policy if exists authenticated_all on public.payments;
create policy payments_read on public.payments for select to authenticated using (true);

drop policy if exists authenticated_all on public.invoice_item_status_history;
create policy invoice_item_status_history_read on public.invoice_item_status_history
  for select to authenticated using (true);

-- 3) Function hardening (advisors 0011 / 0028 / 0029).
-- Pin the one mutable-search_path trigger function.
alter function public.enforce_invoice_item_price_range() set search_path to 'public';

-- is_admin() is referenced by the profiles RLS policies, so authenticated must
-- keep EXECUTE; just remove the anonymous exposure.
revoke execute on function public.is_admin() from anon, public;

-- Trigger functions are fired by triggers, never called via the API.
revoke execute on function public.log_invoice_item_status_change() from anon, authenticated, public;
revoke execute on function public.enforce_invoice_item_price_range() from anon, authenticated, public;
revoke execute on function public.generate_invoice_number() from anon, authenticated, public;
revoke execute on function public.set_invoice_number_default() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.stamp_invoice_item_work_status_updated_at() from anon, authenticated, public;

-- Invoice RPCs are only ever invoked via the service_role (admin) client.
revoke execute on function public.create_invoice_with_items(jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.update_invoice_with_items(uuid, jsonb, jsonb) from anon, authenticated, public;
revoke execute on function public.record_payment(uuid, numeric, uuid, date, text, text) from anon, authenticated, public;
revoke execute on function public.mark_invoice_paid(uuid, uuid, text) from anon, authenticated, public;

-- NOTE: leaked-password protection (advisor auth_leaked_password_protection) is a
-- Supabase Auth setting, not SQL — enable it in the dashboard (Authentication →
-- Sign In / Providers → "Leaked password protection" / HaveIBeenPwned).
