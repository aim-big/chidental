# Roadmap — what's missing for a complete, pleasant-to-use lab POS

Tech-lead assessment (2026-07-02) of the gaps between today's app and a system the lab
can run its whole business on. Ordered by priority; each item says why it matters and
sketches the shape of the fix. Cross out / date items as they ship, and keep decisions
in [CONVENTIONS.md](./CONVENTIONS.md).

---

## P0 — Money correctness & compliance

### 1. Outstanding must net out partial payments (known inconsistency)
The invoice detail page computes `outstanding = total − payments` (per CONVENTIONS §3),
but the dashboard KPI, Reports, statement totals, and A/R aging sum the **full total**
of `partial` invoices — a clinic that paid RM800 of RM1,000 still shows RM1,000 owed.
Harmless while partial payments are rare; wrong the day they aren't.
**Fix:** add an `amount_paid` column on `invoices`, maintained atomically inside the
`record_payment` RPC (and by void). Every outstanding/aging computation then uses
`total − amount_paid` with no extra join. Migration backfills from `payments`.

### 2. LHDN e-Invoice (MyInvois) readiness — confirm with the accountant NOW
Malaysia's mandatory e-invoicing is phasing in by turnover band; small businesses are
entering scope through 2026 (exemption only below a turnover floor). If the lab is in
scope, invoices must carry TIN, SST registration, MSIC code, and buyer identifiers, and
be submitted to MyInvois. **First step is a question, not code:** confirm the lab's
band and start date with the accountant, then scope: settings fields for the lab's tax
identifiers, per-clinic TIN capture, and an export/submission path.

### 3. Close the credits loop
Credits can be issued (clinic detail) and appear on the statement, but they don't flow
anywhere else: Reports ignore them, the dashboard Outstanding ignores them, and a credit
can't settle an invoice. **Fix:** "Apply credit" as a payment method in the Record
Payment dialog (consumes credit atomically in an RPC), credits reflected in the clinic's
statement balance everywhere it's shown, and a printable credit note.

### 4. Monthly statement run
Labs settle with clinics off month-end statements, not individual invoices. Today
statements are printed one clinic at a time. **Fix:** a "Statements" action that
generates all clinics with a non-zero balance for a chosen month — batch print (one
print doc, page break per clinic) first; emailed PDFs later.

---

## P1 — Workflow completeness (how a lab actually operates)

### 5. Case intake before invoice
Work arrives as an RX/case slip, often before pricing is settled — but the app's only
entry point is an invoice. **Fix (lightweight):** a "New case" flow that creates a
draft invoice from intake fields (clinic, patient, doctor, notes, promised date) and
lets the office complete pricing later. Full case entity only if intake diverges
further from invoicing.

### 6. Attachments
Shade photos, impression scans, RX forms — none can be stored. **Fix:** Supabase
Storage bucket + RLS, attachments on the invoice (and its work items), thumbnails on
the detail page, camera upload on tablet.

### 7. Promised/delivery dates for production
The Work board shows the payment due date; production runs on **promised delivery
dates**, which don't exist. **Fix:** `promised_date` on invoice items (or the invoice),
a "due today / overdue" grouping + sort on the Work board, and the WIP dashboard card
gains "N due today".

### 8. Delivery runs
Delivering is a batch activity: pick ready items, print delivery orders, hand to
driver, mark delivered on return. **Fix:** multi-select on Ready items → batch-print
delivery notes → bulk "mark delivered". Signature capture is a later nice-to-have.

### 9. Payment chasing (dunning)
The overdue data now exists (dashboard alert, aging strip) but there's no action on it.
**Fix:** per-clinic "remind" action on the Outstanding tab — composes a WhatsApp/copyable
message listing that clinic's overdue invoices, and stamps "last reminded" so the
office knows who was chased when.

### 10. Repeat-work shortcuts
Same clinic, same product mix, every week. **Fix:** "Duplicate invoice" on the detail
page (copies clinic + items, fresh dates/number), and recently-used products surfaced
first in the product picker per clinic.

---

## P2 — Daily quality of life

- **Role-aware landing:** shop-floor accounts (only `invoices.view`) should land on
  /work, not the finance dashboard. One redirect in the post-login route.
- **Server-side global search:** the command palette loads the newest 1000 invoices and
  filters client-side. Move to a search RPC (`ilike` across invoice #, patient, clinic)
  so old records stay findable as data grows.
- **Bulk invoice actions:** multi-select on the list → mark sent / print delivery notes.
- **Drill-through everywhere:** dashboard Outstanding card → Reports Outstanding tab;
  WIP counts → Work board pre-filtered; By Clinic row → clinic statement. Numbers a
  user can't click are questions the app refuses to answer.
- **Invoice numbering settings:** prefix + yearly reset policy in Settings → Billing
  (currently hardcoded).
- **Tablet ergonomics on the Work board:** bigger touch targets, touch drag on Kanban,
  status dropdown reachable one-handed.
- **Morning digest:** in-app card (later WhatsApp/email) — overdue total, jobs due
  today, yesterday's cash.

---

## P3 — Platform hardening

- **Error monitoring:** `logServerError` writes to the server console nobody reads.
  Wire Sentry (or Vercel's equivalent) so production errors page someone.
- **E2E smoke tests:** Playwright run of login → create invoice → record payment →
  void → reports. Unit tests are strong (276) but can't catch wiring/RLS regressions.
- **Backup & restore drill:** scheduled full export or Supabase PITR tier, plus one
  documented, rehearsed restore. A dental lab's invoice history is its business.
- **Advisor cadence:** run Supabase security/performance advisors after each migration
  wave (RLS gaps, missing indexes on `invoice_date`, `payment_date`, `customer_id`).
- **Report scale guardrail:** reports load every invoice in range into memory — fine
  for years at this lab's volume; revisit with SQL aggregation if a range exceeds
  ~3–5k invoices.
- **PWA install:** manifest + icons so the front desk pins it like an app.

---

## Deliberately NOT doing (unless the business changes)

- Per-clinic payment terms, discounts, tax lines — removed by design (CONVENTIONS §3);
  don't reintroduce without the accountant asking.
- Multi-lab / multi-tenant support.
- Inventory/materials management — different product; revisit only if the lab asks to
  track alloy/ceramic stock.
- Full accounting (ledger, P&L) — the app feeds the accountant; it shouldn't become
  the accounting system.
