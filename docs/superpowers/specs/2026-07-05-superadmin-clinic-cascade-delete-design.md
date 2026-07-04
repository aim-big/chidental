# Super Admin cascade-delete for clinics

**Date:** 2026-07-05
**Status:** Approved (decisions delegated to implementer)
**Related:** [2026-06-24-superadmin-console-design.md](2026-06-24-superadmin-console-design.md), [2026-06-24-archive-clinics-design.md](2026-06-24-archive-clinics-design.md), [docs/CONVENTIONS.md](../../CONVENTIONS.md)

## Problem

A Super Admin cannot fully remove a clinic ("customer") from inside the app when
that clinic still has invoices. `purgeCustomerAction` deliberately **refuses**
while any invoice or credit references the clinic (the `invoices.customer_id` FK
is `ON DELETE RESTRICT`). To clear a test clinic today you must soft-delete and
then purge each invoice one at a time, then archive and purge the clinic — roughly
ten typed confirmations for one clinic. Real cases (test data, a clinic added by
mistake, a closed account, a privacy request) all hit the same wall, forcing the
operator into the Supabase SQL console.

## Goal

Let a Super Admin permanently delete a clinic **and everything hanging off it**
(invoices → line items + payments, plus credits) from the Admin Console, safely
and atomically, without touching Supabase directly.

## Non-goals

- **Merge / reassign duplicates** (move a clinic's invoices to another clinic,
  then delete the empty one). Tracked as a separate future spec.
- Changing the everyday user experience. Normal staff still only **archive**.
- Deep restore. The audit snapshot is a forensic breadcrumb, not a backup.

## Decisions

1. **Ladder, not replacement.** Archive stays the reversible, everyday default
   (gated on `customers.edit`). Cascade hard-delete is the rare Super-Admin
   escalation on top of it. This preserves financial/audit history by default —
   important for a billing system — while giving Super Admins a real "erase it"
   path. Records the intent behind [docs/CONVENTIONS.md](../../CONVENTIONS.md) rule #5.
2. **One entry point.** The delete is triggered only from **Admin Console →
   Archived clinics → "Delete permanently"**. Archive-first remains a deliberate
   cooling-off gate; we do not add a second destructive surface on the clinic page.
3. **Atomic execution via a Postgres RPC.** A `security definer` function
   `admin_purge_clinic(p_id uuid)` performs all deletes in one transaction and
   returns the counts. Mirrors the existing `admin_restore_void` pattern. Chosen
   over sequential `admin.from(...).delete()` calls in the server action, which
   would not be atomic and could leave a half-deleted clinic on partial failure.
4. **Breadcrumb audit snapshot.** One `admin_audit_log` row records the action
   with `metadata` = a JSON snapshot of the clinic row + its invoice rows + credit
   rows. Line items and payments are **not** snapshotted — this matches the
   existing invoice-purge limitation and keeps the payload bounded. This is a
   forensic breadcrumb, not a restore point; the design says so explicitly.

## Behavior

### UX flow (unchanged surface)
1. Super Admin archives the clinic (existing button on the clinic page).
2. Admin Console → **Archived clinics** lists it. Each row shows a **history
   badge** (e.g. "4 invoices") so operators see which clinics carry records
   before acting.
3. Clicking **Delete permanently** opens the existing typed-confirmation dialog,
   now showing the blast radius for a clinic: clinic name, invoice count, credit
   count, and total recorded invoice value, e.g.
   > This permanently deletes **Light**, its **4 invoices** (RM 3,850 in recorded
   > totals) and all their line items and payments, plus **0 credits**. This
   > cannot be undone.
4. Operator types the clinic name to confirm (existing gate). Optional **reason**
   field feeds the audit log.
5. On success: toast, list refreshes, clinic and all its records are gone.

### Data / FK facts (verified 2026-07-05)
- `invoices.customer_id → customers`: `RESTRICT` (must delete invoices first).
- `invoice_items.invoice_id → invoices`: `CASCADE` (auto).
- `payments.invoice_id → invoices`: `CASCADE` (auto).
- `credits.customer_id → customers`: `NO ACTION`; `credits.invoice_id → invoices`:
  `NO ACTION` → the RPC must delete credits **before** invoices/clinic.
- `invoice_activity_log` is **append-only** (trigger `prevent_invoice_activity_mutation`).
  Its breadcrumb rows survive the purge by design — the forensic trail persists
  even though the records are gone. The RPC never touches this table.

## Design

### 1. Migration — `admin_purge_clinic(p_id uuid) returns json`
```sql
create or replace function public.admin_purge_clinic(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits int;
  v_invoices int;
begin
  delete from public.credits  where customer_id = p_id;              -- NO ACTION FK
  get diagnostics v_credits = row_count;

  delete from public.invoices where customer_id = p_id;             -- items + payments cascade
  get diagnostics v_invoices = row_count;

  delete from public.customers where id = p_id;

  return json_build_object('credits', v_credits, 'invoices', v_invoices);
end;
$$;

revoke all on function public.admin_purge_clinic(uuid) from public, anon, authenticated;
```
- Timestamped migration file applied via the Supabase MCP `apply_migration`
  (prod-timestamp version, per project workflow).
- All-in-one transaction: any failure rolls back everything.

### 2. `purgeCustomerAction` ([src/lib/admin/admin-actions.ts](../../../src/lib/admin/admin-actions.ts))
- Keep `requireSuperadmin()` gate.
- **Remove** the dependency-refusal block.
- Before deleting: fetch the clinic row + its invoice rows + credit rows for the
  audit snapshot.
- Call `admin.rpc('admin_purge_clinic', { p_id: input.id })`.
- On error: log + friendly message, return `{ ok: false }`.
- On success: `writeAuditLog({ action: 'customer.purge_cascade', entityType:
  'customer', entityId, entityLabel: clinic_name, reason, metadata: snapshot })`.
- Revalidate `/customers` and `/settings/admin`.

### 3. Admin Console UI ([AdminConsoleClient.tsx](../../../src/app/(authenticated)/settings/admin/AdminConsoleClient.tsx) + [page.tsx](../../../src/app/(authenticated)/settings/admin/page.tsx))
- Server `page.tsx`: for each archived clinic, include `{ invoices, credits,
  total }` counts (extend `getArchivedClinics` / reuse `getClinicDependencyCounts`
  in a single batched query — avoid N+1).
- Archived-clinics table: show a history badge per row.
- Purge dialog: when `purge.kind === 'clinic'`, render the cascade blast-radius
  copy above; add the optional reason textarea (also wired for invoice purge).
- Update the section helper text (currently "only possible once a clinic has no
  invoices or credits left") to describe cascade behavior.

### 4. Conventions
- Update [docs/CONVENTIONS.md](../../CONVENTIONS.md) rule #5 ("Soft-delete, don't
  destroy") with a note: cascade-purge is the sanctioned Super-Admin escalation;
  everyday deletion is still archive.

## Error handling
- Non-Super-Admin: blocked by `requireSuperadmin()` (action) and `superadminOnly`
  nav/route guard (console is already gated).
- RPC failure (any step): transaction rolls back; action returns a friendly error;
  nothing is partially deleted.
- Clinic already gone (race): RPC deletes 0 rows harmlessly; action still succeeds.

## Testing
- **Integration** (local Supabase, per project workflow): seed a clinic with
  invoices (+items, +payments) and a credit; call `admin_purge_clinic`; assert the
  clinic, invoices, items, payments, and credits are all gone and the counts
  returned are correct. Assert the function is not executable by `authenticated`.
- **Gates:** `npm run build` + `npm test` (the working verification gates for this
  project; tsc/lint are not usable here).

## Rollout
1. Apply migration via MCP.
2. Ship action + UI changes.
3. Update CONVENTIONS.md.
4. Verify build + test, then drive the flow once in the running app.
