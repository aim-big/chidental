# Configurable Roles & Permissions — Design

**Date:** 2026-06-10
**Status:** Approved, pending implementation plan

## Problem

Today the app has two hardcoded roles, `admin` and `staff`, defined as a TypeScript
union (`ProfileRole = 'admin' | 'staff'`). Every access decision in the codebase is a
binary `role === 'admin'` check. The business needs:

1. **Custom roles** — create roles with their own names ("Manager", "Operations",
   "Cashier"). Names carry no inherent hierarchy; the stakeholder may rank them however
   they think (e.g. they consider "admin" a low data-entry tier, below "operations").
2. **Per-role permissions** — each role owns a configurable set of capabilities.
3. **A superadmin tier** — a protected top role that always has every permission and is
   the only one who can manage roles, so the business can never lock itself out.

## Non-goals

- **No change to authentication.** Username + 6-digit PIN stays. This feature is
  authorization only. (Separate future hardening: PIN brute-force lockout.)
- **No RLS enforcement in this iteration.** Like the current app, the security boundary
  is server-side action gating. The new schema is RLS-ready for a later pass.
- **No role hierarchy / levels.** Roles are flat; only the built-in Super Admin is special.
- **No dynamic/user-defined permissions.** The permission list ships with the app.

## Model

### Permissions (flat, code-defined constants)

A permission is a single string capability. The app ships this fixed list; users cannot
invent new ones. Grouped only for display in the editor:

| Group     | Permissions |
|-----------|-------------|
| Invoices  | `createInvoice`, `editInvoice`, `deleteInvoice`, `voidInvoice`, `editFinalizedInvoice`, `applyDiscount` |
| Customers | `createCustomer`, `editCustomer`, `deleteCustomer` |
| Products  | `createProduct`, `editProduct`, `deleteProduct` |
| Services  | `createService`, `editService`, `deleteService` |
| Reports   | `viewReports` |
| Staff     | `manageEmployees` |
| Settings  | `manageSettings` |

**18 permissions total.** Browsing/viewing lists & detail pages stays open to any logged-in
user — only the actions above are gated. `viewReports` is the exception (reports can be
hidden from a role). More flags can be added later (payments, refunds, cost visibility,
export) without schema changes — they are just new constants.

**Role management is NOT a permission flag.** Creating/editing/deleting roles is reserved
to the built-in Super Admin. Managing the *staff list* (PIN resets, activation) is the
normal `manageEmployees` flag.

### Data model

**`roles`**
- `id` (uuid, pk)
- `name` (text, editable — e.g. "Operations")
- `description` (text, nullable)
- `is_system` (boolean) — true only for Super Admin; blocks delete & permission edits
- `created_at`, `updated_at`

**`role_permissions`**
- `role_id` (fk → roles, cascade delete)
- `permission` (text — one of the constants above)
- pk (`role_id`, `permission`)
- Editing a role = inserting/deleting rows here.
- Super Admin stores **no** rows; it is treated in code as "has every permission".

**`profiles`**
- New column `role_id` (fk → roles). Replaces the `role` text column.
- The old `role` column is dropped after backfill.

### Superadmin

The built-in **Super Admin** role (`is_system = true`):
- Implicitly has all permissions (no `role_permissions` rows; code short-circuits).
- The only role that can reach the role-management screen and mutate roles.
- Cannot be deleted, renamed away from system status, or have its permissions edited.
- Can be assigned to one or more people.

## Enforcement

### Client (UI gating only — not a security boundary)
- `AuthContext` loads the signed-in user's permission set on login: fetch their
  `profiles.role_id` → role + `role_permissions`. If the role is `is_system`, the set is
  "all".
- Exposes `hasPermission(permission: string): boolean` and `isSuperadmin: boolean`.
- Every current `isAdmin` usage becomes a specific `hasPermission(...)` call:
  - Void/Restore buttons → `hasPermission('voidInvoice')`
  - Employees nav + settings section → `hasPermission('manageEmployees')`
  - Roles settings section → `isSuperadmin`
  - Invoice edit button/lock → via `canEditInvoice` (below)

### Server (the real boundary)
- `requireAdmin()` → generalized to **`requirePermission(permission: string)`**.
  Reads the user's `role_id` from `profiles`, confirms the role grants the permission
  (or the role `is_system`), and that `active === true`. Returns the same
  `{ ok: true, userId } | { ok: false, error }` shape.
- Each server action declares the permission it needs:
  - `voidInvoice` / `restoreInvoice` → `requirePermission('voidInvoice')`
  - `createEmployee` / `updateEmployee` / `resetPin` / `setActive` → `requirePermission('manageEmployees')`
  - New role actions (`createRole`, `updateRole`, `deleteRole`, `assignRole`) → guarded by
    `isSuperadmin` (superadmin-only).

### Invoice permissions
- `canEditInvoice(inv, role)` → `canEditInvoice(inv, perms)`:
  - voided → false
  - draft → requires `editInvoice`
  - finalized (sent/partial/paid/overdue) → requires `editFinalizedInvoice`

## Migration & seed

Seed three roles (names are placeholders the business will rename):

- **Super Admin** — `is_system = true`, all permissions implicitly.
- **Admin** — all 18 permissions (template second tier).
- **Staff** — all permissions **except** `manageEmployees`, `voidInvoice`,
  `editFinalizedInvoice`, `manageSettings`. This reproduces today's staff capabilities so
  existing staff behave identically after migration.

Backfill existing users:
- `profiles.role == 'admin'` → **Super Admin** (current admins are owners; keeps role
  management reachable).
- `profiles.role == 'staff'` → **Staff**.

Then drop `profiles.role`.

## Lockout safety guards

Mirroring today's "admin can't demote/deactivate self" guards:
- The `is_system` Super Admin role cannot be deleted or have permissions edited.
- At least one **active** Super Admin must always exist — block any role reassignment or
  deactivation that would remove the last one.
- A role with users still assigned cannot be deleted — reassign those users first.

## New role-management UI

A new **Settings → Roles** screen (visible only to Super Admin), per-role checklist editor:
- List of roles with a summary (permission count / "all access"), each with edit & delete
  (delete hidden/disabled for `is_system` and for roles with assigned users).
- "New role" + editing opens a form: name, description, and the 18 permissions as grouped
  checkboxes (Invoices / Customers / Products / Services / Reports / Staff / Settings).
- The existing employee editor's role dropdown switches from the hardcoded
  `staff | admin` select to a list of roles fetched from the `roles` table.

## Affected files (from current codebase)

- `src/lib/database.types.ts` — add `Role`, `RolePermission` types; `profiles.role_id`; drop `ProfileRole` union usage.
- `src/lib/permissions.ts` *(new)* — permission constants + display groups.
- `src/contexts/AuthContext.tsx` — load permission set; expose `hasPermission`, `isSuperadmin`.
- `src/lib/auth/require-admin.ts` → `require-permission.ts` — `requirePermission(permission)`.
- `src/lib/auth/employee-actions.ts` — switch gates to `requirePermission('manageEmployees')`.
- `src/lib/auth/role-actions.ts` *(new)* — `createRole` / `updateRole` / `deleteRole` / `assignRole`, superadmin-gated.
- `src/lib/invoices/void-actions.ts` — `requirePermission('voidInvoice')`.
- `src/lib/invoice-permissions.ts` — `canEditInvoice(inv, perms)`.
- `src/components/layout/AppShell.tsx` — nav gating via `hasPermission` / `isSuperadmin`.
- `src/app/(authenticated)/settings/page.tsx` — sections gated by permission.
- `src/app/(authenticated)/settings/roles/page.tsx` *(new)* + `RolesManager` component.
- `src/app/(authenticated)/settings/employees/page.tsx` — gate on `manageEmployees`.
- `src/components/employees/EmployeesManager.tsx` — role select from `roles` table.
- `src/app/(authenticated)/invoices/[id]/page.tsx`, `src/components/invoices/InvoiceForm.tsx` — capability-based gating.
- DB migration — create `roles`, `role_permissions`; add `profiles.role_id`; seed; backfill; drop `profiles.role`.
