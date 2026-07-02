# Reports page on-page insights (cards, Payments tab, By Clinic split) — design

- **Date:** 2026-07-02
- **Status:** Implemented
- **Area:** `/reports` page — `@/lib/reports`, `@/components/reports/ReportsClient`

## Context

The Sales Summary CSV (`2026-07-02-sales-summary-report-design.md`) surfaced two
gaps on the page itself: the per-clinic paid/outstanding/draft split existed only
in the CSV, and the payments the page already fetches were used only for CSV —
never shown on-page. The user asked to round out the page ("all needed features").

## Decisions

1. **4th summary card — "Cash Received"**: Σ `payments.amount` in range, with the
   payment count. Distinct on purpose from "Collected (Paid)", which is the full
   value of paid-status invoices (invoice value vs cash). Card grid becomes
   `sm:grid-cols-2 lg:grid-cols-4`; "Collected (Paid)" gains a clarifying
   subtitle ("value of paid invoices").
2. **New "Payments" tab**: the cash-received list (Date, Invoice #, Clinic,
   Reference, Amount) with a Total row — the on-page twin of the Payment Report
   CSV, same `payments` prop, date-ascending.
3. **By Clinic tab upgraded**: table now shows the Sales Summary columns
   (Invoices, Total Sales, Paid, Outstanding, Draft — the CSV's exact
   partition), driven by `summary.salesSummary`. Chart unchanged (top 10 by
   total). Title: "Sales by Clinic".
4. **`byCustomer` removed from `ReportSummary`**: `salesSummary` is a strict
   superset (same names/counts/totals/sort + the split), so the page-level
   duplicate aggregation goes. `aggregateByCustomer` itself stays — the
   dashboard (`@/lib/dashboard`) still uses it.

## Scope

No new DB query, no schema change, no permission change. Tab order:
Outstanding · Paid · Payments · By Clinic · By Product.

## Testing

- `reports.test.ts`: summary-level assertions moved from `byCustomer` to
  `salesSummary` (function-level `aggregateByCustomer` tests unchanged).
- Client changes build-verified (`npm run build`); gates: `npm test` + build.
- `USER_GUIDE.md` §8 rewritten to describe the range picker, cards, tabs, and
  the four CSV exports.
