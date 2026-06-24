# Invoice naming: Draft → Issued

**Date:** 2026-06-24
**Status:** Approved (design)

## Problem

The invoice flow over-promises delivery. Nothing is actually *sent* yet (the
send feature — email/WhatsApp delivery — is deferred), but the UI says:

- `Create & Send` (create form primary button)
- `Mark as Sent` (detail page, draft → finalized)
- `Sent` (status badge, everywhere)

This confuses users: the action finalizes/issues an invoice; it does not send it.

## Principle

Follow the existing **Clinic-in-UI / customer-in-code** convention. Keep the DB
status value `'sent'` untouched — no migration, all filters/queries/badge-variant
logic keep working. Change **user-facing labels only**. Code/DB still says `sent`;
the UI says **"Issued"**.

Chosen finalized term: **Issued** (standard accounting term for a finalized
receivable; does not imply delivery).

## Changes

### 1. Create form — `src/components/invoices/InvoiceForm.tsx`
- Primary button `Create & Send` → **`Create`**. Still calls `handleCreate('sent')`.
- Secondary `Save as Draft` → unchanged.
- Create toast `'Invoice created'` → unchanged (already neutral).

### 2. Invoice detail — `src/components/invoices/detail/ActionsBar.tsx`
- Button `Mark as Sent` → **`Issue Invoice`**. Still calls `markSentAction()`.
- Toast `'Invoice marked as sent'` → **`'Invoice issued'`**.
- Header status badge shows **"Issued"** via the label map below.

### 3. Status badge label — `src/lib/status-badge.ts`
- Badges currently render the raw status string (`{inv.status}` + `capitalize`),
  so `sent` displays as "Sent" everywhere.
- Add a label map (`sent → "Issued"`; all other statuses pass through unchanged)
  plus a small helper (e.g. `statusLabel(status)`).
- Update the badge render sites to use the label instead of the raw string:
  - `ActionsBar.tsx` (header)
  - `InvoiceListClient.tsx`
  - `DashboardRecentInvoices.tsx`
  - `CustomerInvoiceHistory.tsx`
  - any other site rendering `{inv.status}` in a Badge.

### 4. List tab/filter — `src/components/invoices/InvoiceListClient.tsx`
- `Drafts` tab unchanged.
- If a "Sent" tab/filter label exists, relabel to **"Issued"** (confirm during
  implementation).

## Out of scope (deferred)
- The actual **send** feature (email/WhatsApp delivery).
- Any DB / enum rename (`sent` stays the stored value).

## Acceptance
- No occurrence of user-facing "Sent" / "Mark as Sent" / "Create & Send" remains
  in invoice UI; "Issued" / "Issue Invoice" / "Create" appear instead.
- Status value stored in DB is still `'sent'`; no migration.
- All existing status filters and badge variants behave as before.
- `tsc` and `eslint` pass.
