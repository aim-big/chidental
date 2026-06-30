-- Split invoice "create" out of "edit".
--
-- Previously `invoices.edit` granted BOTH creating new invoices and editing
-- existing drafts. We introduce a dedicated `invoices.create` permission so a
-- role can create without editing (and vice versa).
--
-- Backfill: every role that can currently create (i.e. holds `invoices.edit`)
-- keeps that ability by also receiving `invoices.create`. No role loses the
-- New Invoice button. Super Admin (is_system) holds all permissions implicitly
-- and needs no row. Operators can remove `invoices.create` from specific roles
-- afterward via the role editor.
insert into public.role_permissions (role_id, permission)
select rp.role_id, 'invoices.create'
from public.role_permissions rp
where rp.permission = 'invoices.edit'
  and not exists (
    select 1
    from public.role_permissions existing
    where existing.role_id = rp.role_id
      and existing.permission = 'invoices.create'
  );
