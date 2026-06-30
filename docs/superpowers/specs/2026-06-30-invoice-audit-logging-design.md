# Invoice Audit Logging — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation
**Owner:** suddenly6666@gmail.com

## Problem

Invoice actions (issue/mark-sent, record payment, void, edit, recipient/case/service-status
changes, work notes, work-status changes, admin soft-delete/restore/purge) need to record
**which user performed each action, and when**, so staff can see a per-invoice activity
timeline and admins have a central, immutable audit trail for accountability/compliance.

Today, only a few actions stamp the actor (`invoices.created_by`, `payments.created_by`,
`invoices.voided_by`); many actions record nothing, and there is no single place to answer
"who did what, and when, on this invoice?".

## Decisions (from brainstorming)

- **Purpose:** Both — a user-facing per-invoice timeline **and** a central admin audit view.
- **Scope:** Everything — lifecycle + content edits + work-status changes, unified.
- **Edit detail:** Field-level before/after diffs.
- **Architecture:** Approach A — a dedicated `invoice_activity_log` table written explicitly
  from server actions (reliable actor, incl. void/admin via the service-role client), with the
  existing work-status trigger merged at read time.

### Why action-layer capture (not DB triggers)

Void, soft-delete, restore, and purge run through the **service-role (admin) client**, which
has no user session, so `auth.uid()` is `null` inside DB triggers for exactly the actions we
most want to attribute. The server-action layer always knows the actor (`requirePermission()`
returns `gate.userId`), so capturing in actions gives a reliable actor everywhere, plus
semantic events and money-aware labels that triggers can't easily produce.

## Data model

### New table `invoice_activity_log` (append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `invoice_id` | `uuid` | FK → `invoices(id)` **ON DELETE SET NULL** (survives purge) |
| `actor_id` | `uuid` NOT NULL | FK → `auth.users(id)` |
| `actor_name` | `text` NOT NULL | snapshot of `profiles.full_name` (fallback `username`) at write time |
| `action` | `text` NOT NULL | semantic key, e.g. `invoice.issued`, `payment.recorded` |
| `entity_label` | `text` | snapshot of `invoice_number` (survives purge) |
| `changes` | `jsonb` | `[{field, label, from, to}]` — changed fields only; null for pure lifecycle events |
| `reason` | `text` | void/delete reasons |
| `metadata` | `jsonb` | extra structured context (payment amount/id, line-item id+label, etc.) |
| `created_at` | `timestamptz` NOT NULL | `now()` |

- **Indexes:** `(invoice_id, created_at desc)`, `(created_at desc)`, `(actor_id, created_at desc)`.
- **Security / immutability:** RLS enabled with **no policies** → service-role only (mirrors
  `admin_audit_log`). All writes go through the admin client inside server actions; all reads
  go through gated server components/actions. A `BEFORE UPDATE OR DELETE` trigger raises to
  enforce true append-only.
- **No human copy stored in the DB:** `action` + `changes` + `metadata` are structured; the UI
  renders labels (keeps the Clinic/`customer` naming rule and relabeling out of the data).

## Capture

- Extend `src/lib/audit/audit-log.ts` with `logInvoiceActivity(entry)` writing to the new table
  (best-effort, same as today's `writeAuditLog`).
- Extend `requirePermission()` (`src/lib/auth/require-permission.ts`) to also return `actorName`
  — it already joins `profiles` for the role check, so add `full_name`/`username` to that select
  (no extra query per action).
- **Field diffs:** for edit actions, read the invoice's current row *before* the mutation,
  compare to the new input, emit `changes` for changed fields only. A diff helper
  (`src/lib/audit/diff.ts`) computes the changed-field set. **No-op saves (nothing changed)
  write no event** — avoids timeline noise.
- **Work-status** changes are **not** written here — they keep their existing trigger →
  `invoice_item_status_history`, and are merged into the timeline at read time.

### Event catalogue

| Server action | `action` key | Captures |
|---|---|---|
| `createInvoiceAction` | `invoice.created` | actor, invoice_number, initial status |
| `markSentAction` | `invoice.issued` | actor |
| `updateInvoiceAction` | `invoice.edited` | field diffs (header + line-item changes) |
| `saveRecipientAction` | `invoice.recipient_changed` | bill-to/ship-to diffs |
| `updateCaseDetailsAction` | `invoice.case_changed` | patient/doctor diffs |
| `updateServiceStatusAction` | `invoice.service_status_changed` | from→to status |
| `updateWorkNoteAction` | `invoice.work_note_changed` | item label + note diff |
| `recordPaymentAction` | `payment.recorded` | amount, date, reference in metadata |
| `voidInvoice` | `invoice.voided` | reason |
| `softDeleteInvoiceAction` (admin) | `invoice.soft_deleted` | reason |
| `restoreInvoiceAction` (admin) | `invoice.restored` | — |
| `restoreVoidedInvoiceAction` (admin) | `invoice.void_restored` | — |
| `purgeInvoiceAction` (admin) | `invoice.purged` | row snapshot in metadata |

Admin destructive actions move their logging to `logInvoiceActivity` (so they appear in the
invoice timeline **and** the admin view). `admin_audit_log` stays for non-invoice entities
(customer/product/employee).

## Reads

### Per-invoice timeline

- `getInvoiceActivity(invoiceId)` server function: after `requirePermission('invoices.view')`,
  uses the admin client to:
  - select `invoice_activity_log` where `invoice_id = id`;
  - select `invoice_item_status_history` (join `invoice_items`) where `invoice_id = id`,
    normalize to work-status events (uses `changed_by_name`);
  - merge + sort `created_at`/`changed_at` desc → `TimelineEvent[]`.
- UI: new **Activity** panel/section on the invoice detail page (server component). Each row:
  actor name, action label (Clinic-naming-safe, i18n-friendly), relative timestamp, and
  expandable field diffs for edits. Visible to `invoices.view`.

### Admin compliance view

- Superadmin page (under the existing admin area) listing `invoice_activity_log` globally with
  filters (actor, action type, date range, invoice). Reads via admin client after
  `requireSuperadmin()`. If an `admin_audit_log` viewer already exists, mirror its pattern;
  otherwise add an "Activity log" admin page. (Confirm existing admin UI during planning.)

## Error handling

Logging is **best-effort**: never fail the user's mutation if the audit insert fails. On error,
call `logServerError('audit', err, ctx)` and continue — matches the existing `writeAuditLog`
convention. (If strict guaranteed logging is later required, move the insert into the mutation
RPC/transaction.)

## Testing (TDD)

Run via `npm test` + `npm run build` (project verification gates; tsc/lint are unusable here).

- Diff helper: changed-field extraction, no-op detection, value formatting.
- `logInvoiceActivity`: inserts the expected row shape per action.
- Each wired action emits the right event (and no-op edits emit nothing).
- Timeline aggregator merges + orders both sources correctly.

## Migration & backfill (MCP `apply_migration`)

1. Create `invoice_activity_log` table + indexes + RLS (enabled, no policies) + append-only
   `BEFORE UPDATE OR DELETE` trigger.
2. One-time backfill from known columns:
   - `invoice.created` from `invoices.created_by` / `created_at`;
   - `payment.recorded` from `payments.created_by` / `created_at` / `amount`;
   - `invoice.voided` from `invoices.voided_by` / `voided_at` / `void_reason`;
   - `invoice.soft_deleted` from `invoices.deleted_by` / `deleted_at` / `delete_reason`.
   Work-status history already exists in `invoice_item_status_history` (unioned at read, no
   backfill).
3. Regenerate TS types after migration.

## Edge cases

- Actor name changes later → snapshot preserves the historical name.
- Admin/service-role actions → attributed via `gate.userId` (+ `actorName`) passed explicitly.
- Purge (hard delete) → `invoice_id` set null, `entity_label` retains `invoice_number`; the log
  row survives for the admin view.
- Concurrent edits → each appends its own row.
- No-op edits → skipped (no event written).

## Out of scope

- Field-level diffs of line-item *work status* (kept in the existing trigger table as-is).
- Generalizing `admin_audit_log` for non-invoice entities (left unchanged).
- Real-time/live updates of the timeline (standard server-render/refresh is fine).
