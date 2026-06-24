# Archive (soft-delete) clinics — design

**Date:** 2026-06-24
**Status:** Approved, pending implementation plan

## Problem

There is no way to remove a clinic from the app. A hard `DELETE` is unsafe and
mostly impossible anyway: `invoices.customer_id` is `ON DELETE RESTRICT`
([baseline_schema.sql:791](../../../supabase/migrations/00000000000000_baseline_schema.sql))
and `credits.customer_id` defaults to `NO ACTION`
([create_credits.sql:17](../../../supabase/migrations/20260623080506_create_credits.sql)),
so any clinic with activity cannot be deleted, and forcing it would orphan
financial history. We want a way to retire a clinic that preserves all history.

> Naming: the UI says **"Clinic"**, the code/DB stays `customer`
> (see [docs/CONVENTIONS.md](../../CONVENTIONS.md)).

## Decision

Soft-delete via **archive**, fully reversible. No hard delete (one code path).
Gated on the existing `customers.edit` permission (no new permission key).

## Data model

Add one nullable column to `public.customers`:

- **`archived_at timestamptz`** — `NULL` = active; a timestamp = archived
  (records when it was archived).

Rationale: matches the codebase's existing "hide but keep history" convention
(`products.active`, `service_statuses.is_active`), but as a timestamp so we
retain the archived date. Migration only adds the column — no backfill, no RLS
policy change (writes use the admin/service-role client; SSR reads are
RLS-aware and a new column needs no new policy). FK constraints are unchanged;
`ON DELETE RESTRICT` becomes an unreachable backstop since we never hard-delete.

## Server actions — `src/data/customer-actions.ts`

Two new actions, mirroring the existing `createCustomerAction`/`updateCustomerAction`
pattern (permission gate → admin client → mutate → revalidate → `ActionResult`):

- `archiveCustomerAction(id: string)` → gate `customers.edit`; set
  `archived_at = now()`; revalidate `/customers` and `/customers/${id}`.
- `restoreCustomerAction(id: string)` → gate `customers.edit`; set
  `archived_at = null`; revalidate `/customers` and `/customers/${id}`.

## Where archived clinics are hidden

| Location | Function | Change |
|---|---|---|
| Clinic directory | `getCustomersPage()` (`src/data/customers.ts`) | Hide archived by default; add an **"Archived"** filter toggle (URL-driven) so archived clinics can be found and restored |
| Command palette / global search | `getCustomers()` (`src/data/customers.ts`, used by `src/data/search-actions.ts`) | Filter `archived_at IS NULL` |
| New-invoice clinic picker | `getInvoiceFormData()` (`src/data/invoices.ts`) | Filter `archived_at IS NULL` so an archived clinic cannot be billed |

Historical invoices, statements, and reports are **untouched** — they read
`customer_id` directly and join the customer row regardless of archived state,
so all past data still resolves.

## UI

- **`CustomerDetailHeader`** (`src/components/customers/CustomerDetailHeader.tsx`):
  - Active clinic: add an **Archive** button (gated `customers.edit`) with a
    confirm dialog — *"Archive this clinic? It will be hidden from lists and new
    invoices. You can restore it later."*
  - Archived clinic: show an **"Archived"** badge; replace the Edit / New-Invoice
    affordances with a **Restore** button (gated `customers.edit`).
- The clinic **detail page stays accessible** when archived (so it can be
  restored); only the directory list / pickers hide it.

## Edge case

Editing an existing invoice whose clinic was archived after the invoice was
created: the invoice already stores a recipient snapshot (bill-to / ship-to)
and its own `customer_id`, so the form renders correctly. Additionally, in
**edit mode** merge the invoice's own clinic into the picker list so the
dropdown still shows its name even though it's archived.

## Testing

- `archiveCustomerAction` / `restoreCustomerAction`: permission gate (denied
  without `customers.edit`) and the `archived_at` state transition.
- Query filters: an archived clinic is excluded from the directory default and
  the invoice clinic picker, and is included when the directory "Archived"
  filter is on.

## Out of scope (YAGNI)

- Hard delete of zero-activity clinics — explicitly declined; archive-only.
- A dedicated `customers.delete` permission — reuse `customers.edit`.
- Bulk archive/restore.
