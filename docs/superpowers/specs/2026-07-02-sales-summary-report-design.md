# Sales Summary report (totals-only, by clinic) — design

- **Date:** 2026-07-02
- **Status:** Implemented
- **Area:** `/reports` page — `@/lib/reports`, `@/lib/reports-exports`, `@/components/reports/ReportsClient`

## Context

The `/reports` page has an **Export ▾** menu with three focused CSV reports
(Sales / Payment / Item Sales — see `2026-06-30-three-csv-reports-design.md`).
The user asked for a report of **total sales regardless of payment status**.

Investigation showed the existing **Sales Report** already lists every non-voided
invoice in the period (paid *and* unpaid) and totals them — so "total sales
regardless of paid" already exists at the row level. What's missing is a
**totals-only summary**: no per-invoice rows, just totals grouped by clinic, so
the user sees *how much each clinic bought and how much of it is still owed* at a
glance. This is the "Summary" counterpart to the detailed "Sales Report"
(mirrors kumoDent's Sales Summary / Sales Detailed pairing).

## Decisions

- Add a **fourth CSV report — "Sales Summary"** to the existing Export ▾ menu.
  CSV only; no new charting, no PDF, no schema change, **no new DB query**
  (reuses the invoices the page already fetches).
- **Grouped by clinic**, one row per clinic, sorted by Total Sales descending,
  with a grand-total row.
- **Totals-only** — no per-invoice detail (that is the detailed Sales Report).
- Break Total Sales down by payment status as a **true partition** so the money
  columns always sum to Total Sales.

### Two logic findings that shaped the columns

1. **Drafts are dated and leak into date-ranged queries.** `invoice_date` is set
   at creation (`InvoiceForm` defaults it to today), so a `draft` invoice appears
   in the range like any other. The existing reports already count non-voided
   drafts. A naïve `Total = Paid + Outstanding` split would therefore **not
   reconcile** — the draft value would be unaccounted for. → give Draft its own
   column so the columns partition the total exactly.
2. **"Collected" would misrepresent the numbers.** At the aggregate level,
   "paid" = *full value of `paid`-status invoices* and "outstanding" = *full value
   of `sent/partial/overdue` invoices* (including the already-paid portion of a
   `partial`). These are **invoice values by status, not cash**. Real cash
   collected is the **Payment Report's** job. → use invoice-value labels
   ("Paid", not "Collected") so the two reports don't contradict each other.

## The report

### Sales Summary — total sales by clinic, for the selected range

Title block (identical convention to the other three reports): `COMPANY.name`,
`Sales Summary`, `Range,<from> to <to>`, `Generated,<yyyy-MM-dd>`, blank line.

Columns: `Clinic, Invoices, Total Sales, Paid, Outstanding, Draft`

```
Sales Summary
CHI Dental Lab
Range,2026-06-01 to 2026-06-30
Generated,2026-07-02

Clinic,Invoices,Total Sales,Paid,Outstanding,Draft
Bright Smile,12,4820.00,3600.00,1220.00,0.00
CityDental,9,3410.00,3110.00,0.00,300.00
Total,21,8230.00,6710.00,1220.00,300.00
```

Row semantics (per clinic):
- **Basis:** all **non-voided** invoices with `invoice_date` in range — the *same*
  basis as the detailed Sales Report, so the two reports' grand totals reconcile.
- **Invoices** = count of those invoices.
- **Total Sales** = Σ `invoice.total` (the "regardless of paid" figure).
- **Paid** = Σ `total` of invoices where `countsAsRevenue` (status `paid`,
  non-voided).
- **Outstanding** = Σ `total` of invoices where `isOutstanding` (status
  `sent`/`partial`/`overdue`, non-voided).
- **Draft** = `Total Sales − Paid − Outstanding` — computed as the **remainder**,
  so `Paid + Outstanding + Draft ≡ Total Sales` even if a new status is ever
  added. With today's statuses this is exactly the `draft` invoice value (usually
  `0.00`).
- **Clinic** name falls back to `Unknown` when a clinic name is missing
  (consistent with `aggregateByCustomer`).

Sorting: Total Sales descending. **Total row** sums every numeric column.

Formatting: money 2-dp plain numbers, dates ISO, RFC-4180 quoting, CRLF endings,
UTF-8 BOM at download — same as the other three reports.

Filename: `sales-summary_<from>_<to>.csv`.

Empty range: title block + header row + a `Total` row of zeros (matches the other
builders' empty-data behavior).

## Architecture

Keep the server-first flow; build the CSV client-side from data the page already
passes. No new I/O.

### `src/lib/reports.ts`
- Add `type SalesSummaryRow = { name: string; count: number; total: number; paid: number; outstanding: number; draft: number }`.
- Add `aggregateSalesSummary(invoices: ReportInvoice[]): SalesSummaryRow[]` — pure,
  groups non-voided invoices by clinic using `countsAsRevenue` / `isOutstanding`,
  computes `draft` as the remainder, sorts by `total` desc. (Mirrors the shape and
  style of `aggregateByCustomer`.)
- Add `salesSummary: SalesSummaryRow[]` to `ReportSummary`; `summarizeReports`
  fills it from `active` (the already-computed non-voided set).

### `src/lib/reports-exports.ts`
- `buildSalesSummaryReportCsv(rows: SalesSummaryRow[], range, generatedOn): string`
  — pure, uses the existing `titleBlock` / `row` / `money` helpers.
- `salesSummaryReportFilename(range): string` → `sales-summary_<from>_<to>.csv`.

### `src/components/reports/ReportsClient.tsx`
- Add a **"Sales Summary"** item to the Export ▾ `DropdownMenuContent`, placed
  first (headline summary), above "Sales Report" (the detailed list). Runs the
  existing Blob-download routine on `buildSalesSummaryReportCsv(summary.salesSummary, range, todayISODate())`.
- No new props — `salesSummary` rides along on the existing `summary` prop.

### Untouched
- No change to `src/data/reports.ts` (no new query), the page component, the
  on-page tabs/cards, permissions, or the schema.

## Components & isolation
- `aggregateSalesSummary` — pure aggregation; input invoices → rows. Unit-testable.
- `buildSalesSummaryReportCsv` — pure string builder; rows + range → CSV text.
  Unit-testable.
- `ReportsClient` — the only DOM piece (one extra menu item + existing download).

## Testing
- `src/lib/reports.test.ts` (extend): `aggregateSalesSummary` groups by clinic,
  partitions into paid/outstanding/draft, `Paid + Outstanding + Draft === Total`
  per row (incl. a draft-present case and a partial-status case), sorts by total
  desc, `Unknown` fallback; `summarizeReports` populates `salesSummary`.
- `src/lib/reports-exports.test.ts` (extend): `buildSalesSummaryReportCsv` —
  title block, columns, 2-dp money, Total row sums each column, reconciliation
  (Total row Paid+Outstanding+Draft === Total Sales), empty-data zeros case,
  RFC-4180 quoting (clinic name with a comma).
- `ReportsClient` / page: build-verified (`npm run build`) + a browser check of
  the new Export ▾ item and the download. (No `.tsx` unit test — vitest is
  node-env, `*.test.ts` only.)
- Gates: `npm test` + `npm run build` (the project's only working gates).

## Risks / mitigations
- **Non-reconciling totals** if drafts/new statuses are unaccounted → Draft is the
  remainder, so columns provably sum to Total Sales; a unit test asserts it.
- **Confusion with the Payment Report** (cash vs invoice value) → invoice-value
  labels ("Paid"/"Outstanding"), documented here; Payment Report stays the
  cash-collected view.
- **Basis drift** from the detailed Sales Report → both use the same non-voided,
  in-range `active` set from `summarizeReports`, so grand totals match.
