# Sales Reports & CSV Export improvements — design

- **Date:** 2026-06-30
- **Status:** Approved (pending spec review)
- **Area:** `/reports` page, `@/lib/reports`, `@/lib/reports-csv`

## Context

The Sales Reports page (`/reports`) is server-first: `page.tsx` reads a
`?from&to` date range (default: current month), `getReportInvoices` fetches the
date-ranged invoices, `summarizeReports` computes a `ReportSummary`, and
`ReportsClient` renders it (summary cards, Outstanding/Paid tables, By-Clinic /
By-Product top-10 charts). A single-file CSV export (`buildReportCsv`) was added
in the prior change.

The user asked to "make our reporting better and the exported better," using the
kumoDent / Aoikumo ERP (`bigdental.aoikumo.com`) as a reference — **but
explicitly simpler**. A browser study of that tool showed a large categorised
report library (Sales/Payment/Inventory/Customer/Commission/Appointment/
Employee/Clinical/TPA/Accounting-Export), per-report Print + Download + ⋯
actions, report search, favourites, and a date-range picker with presets. We are
**not** replicating that breadth.

## Decisions (from brainstorming)

- Goal: improve **both** the on-screen report and the export.
- Export stays **CSV only** — no PDF, no Excel, no new dependencies — but the CSV
  must be **clean and better**.
- On-screen improvements chosen: **date-range presets** and **full By-Clinic /
  By-Product breakdowns**. (Not chosen: aging buckets, detailed line-item view.)
- By-Clinic / By-Product keep their **top-10 chart** and gain a **full table**
  below it.

## Scope

**In scope**
1. Date-range presets on `/reports`.
2. Full By-Clinic / By-Product breakdown tables (all rows + totals) under the
   existing top-10 charts.
3. A cleaner, richer whole-report CSV.

**Out of scope (non-goals)**
- PDF / Excel export; any new dependency.
- A categorised report library, report search, or favourites.
- Aging buckets, detailed per-line-item view.
- Changes to the dashboard, invoices, permissions, or DB schema.

## Approach

Extend the existing server-first pattern. No new data sources, no new routes, no
server actions. The only data-shape change is that the report's
`ReportSummary.byCustomer` / `byProduct` carry **all** rows (the chart slices to
10 client-side). The dashboard, which shares the aggregation helpers, is
unaffected because the helpers keep their default top-10 behaviour.

### 1. Date-range presets

A button row above the existing From/To inputs in `ReportsClient`:

```
[ This month ] [ Last month ] [ This quarter ] [ Year to date ] [ Custom ]
   From [01/06/2026]   To [30/06/2026]    ⟳        [ Export CSV ]
```

- Presets compute `{from,to}` with `date-fns` and reuse the existing `setRange`
  (URL-param navigation → server re-fetch). No new state machine.
  - This month: `startOfMonth(now)` … `endOfMonth(now)`
  - Last month: `startOfMonth(subMonths(now,1))` … `endOfMonth(subMonths(now,1))`
  - This quarter: `startOfQuarter(now)` … `endOfQuarter(now)`
  - Year to date: `startOfYear(now)` … `now` (today)
  - Custom: no-op; the manual From/To inputs are the custom path.
- The button matching the current `{from,to}` is highlighted (`variant="default"`
  vs `variant="outline"`); when no preset matches, "Custom" is highlighted.
- "This month" remains the default range (unchanged behaviour).
- Preset detection is a pure helper `activePreset(from, to, now)` →
  `'month' | 'lastMonth' | 'quarter' | 'ytd' | 'custom'`, unit-tested.

### 2. Full breakdown tables

Under each existing chart (chart keeps showing **top 10**), add a full table with
every row and a totals row:

```
Revenue by Clinic            [chart: top 10]
─ All clinics ──────────────────────────────
Clinic                       Invoices   Total
Origin Dental Clinic               6   RM 4,500
…(all rows, sorted by Total desc)…
─────────────────────────────────────────────
TOTAL                             14   RM 15,180
```

- Same for By Product (columns: Product, Quantity, Total).
- Sorted by Total descending (matches the aggregation order). No interactive
  sort in v1 — keep it simple; the data already arrives sorted.
- Uses the shared `Table` component; totals row uses the existing
  `formatCurrency`.

### 3. Clean, richer CSV

`buildReportCsv` is rewritten to emit a cleaner whole-report file:

- **Title block:** `COMPANY.name`, `Sales Report`, `Range,<from> to <to>`,
  `Generated,<yyyy-MM-dd>`.
- **Summary** as a `Metric,Value` table.
- **Outstanding Invoices** — full list; columns `Invoice #, Clinic, Due Date,
  Days Overdue, Amount, Status`; trailing `Subtotal` row (= total outstanding).
  Days Overdue is the raw integer (negative = not yet due).
- **Paid Invoices** — full list; columns `Invoice #, Clinic, Invoice Date,
  Amount, Status`; trailing `Subtotal` row (= total paid).
- **Revenue by Clinic** — **all** rows; columns `Clinic, Invoices, Total`;
  trailing `Total` row.
- **Revenue by Product** — **all** rows; columns `Product, Quantity, Total`;
  trailing `Total` row.
- **Money is formatted to exactly 2 decimals** (e.g. `1800.00`) — still a plain
  number Excel can sum, but visually consistent. Dates stay ISO `yyyy-MM-dd`.
- RFC-4180 field quoting, CRLF line endings, and the UTF-8 BOM (added at download
  time in `ReportsClient`) are retained so Excel opens it cleanly.
- Filename unchanged: `sales-report_<from>_<to>.csv`.

Generated date is passed in by the caller (`todayISODate()` from
`@/lib/utils`) so `buildReportCsv` stays deterministic and unit-testable.

## Data / type changes

`src/lib/reports.ts`
- `aggregateByCustomer(invoices, limit = 10)` and
  `aggregateByProduct(invoices, limit = 10)` gain an optional `limit`; passing
  `Infinity` returns all rows. Default 10 preserves dashboard behaviour.
- `summarizeReports` calls them with `Infinity`, so `ReportSummary.byCustomer` /
  `byProduct` now contain **all** rows. (Types unchanged — still
  `CustomerAgg[]` / `ProductAgg[]`.)

No other type changes. `dashboard.ts` keeps calling
`aggregateByCustomer(active)` / `aggregateByProduct(active)` → still top 10.

## File-by-file

- `src/lib/reports.ts` — add `limit` param to the two aggregators; call with
  `Infinity` in `summarizeReports`. (No preset logic here — it lives in
  `reports-presets.ts`.)
- `src/lib/reports-presets.ts` *(new)* — pure preset math: `presetRange(kind,
  now)` and `activePreset(from, to, now)`, so the date logic is isolated and
  testable without React.
- `src/lib/reports-csv.ts` — rewrite `buildReportCsv` per §3; add `generatedOn`
  argument; 2-dp money helper.
- `src/components/reports/ReportsClient.tsx` — preset button row; full breakdown
  tables under each chart; pass `todayISODate()` into `buildReportCsv`.
- Tests: `src/lib/reports-presets.test.ts` *(new)*, update
  `src/lib/reports-csv.test.ts` (title block, 2-dp money, full breakdowns,
  totals rows), extend `src/lib/reports.test.ts` (aggregator `limit`).

## Components & isolation

- **Preset math** (`reports-presets.ts`): pure, no React, no DOM. Input: range +
  `now`. Output: ranges / active-preset key. Fully unit-testable.
- **CSV builder** (`reports-csv.ts`): pure string builder. Input: `summary`,
  `range`, `generatedOn`. Output: CSV text. No DOM/Blob.
- **`ReportsClient`**: the only stateful/DOM piece — owns navigation, the Blob
  download, and rendering. It composes the two pure modules.

## Testing

- `reports-presets.test.ts`: each preset's range for a fixed `now`; `activePreset`
  round-trips each preset and returns `'custom'` for an arbitrary range.
- `reports-csv.test.ts`: title block present; money rendered 2-dp; full
  breakdowns include every row; subtotal/total rows correct; quoting + CRLF
  retained; empty-data case.
- `reports.test.ts`: `aggregateByCustomer`/`aggregateByProduct` respect `limit`
  (default 10, `Infinity` returns all); `summarizeReports` returns full
  breakdown arrays.
- Gates: `npm test` and `npm run build` must pass (per project verification
  gates; tsc/lint are not used).

## Risks / mitigations

- **Dashboard regression** from changing aggregators → mitigated by a defaulted
  `limit = 10`; dashboard call sites unchanged.
- **Large breakdown tables** for labs with many clinics/products → acceptable;
  the page already loads all invoices for the range. No pagination in v1.
