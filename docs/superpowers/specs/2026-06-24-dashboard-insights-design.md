# Dashboard Insights Redesign

**Date:** 2026-06-24
**Status:** Approved (build directly, review after)

## Goal

Turn the dashboard from a stat-cards + recent-invoices list into an at-a-glance,
insight-first landing page. Reports stays the deep-dive tool; the dashboard
reuses its aggregation where it overlaps.

## Scope

- URL-driven **date-range selector** (`?from&to`, defaults to current month) —
  same pattern as the Reports page.
- **4 KPI cards**: Sales · Payment · Outstanding · Total Invoices.
  - **Sales** = Σ non-voided invoice totals (invoices issued in range).
  - **Payment** = Σ `payments.amount` where `payment_date` in range (real cash collected).
  - **Outstanding** = Σ outstanding invoice totals (point-in-time, not range-bound).
  - **Total Invoices** = count in range.
- **Growth metrics**: period-over-period sales growth %, avg invoice value trend,
  new-vs-returning clinics.
- **Sales vs Payment trend** chart (monthly buckets across the range).
- **Top selling products** + **Top clinics** (reuse reports aggregation).
- **Remove** the Recent Invoices table entirely.

## Architecture (Approach A)

Server-first + pure-testable-lib + client-island, matching the existing app.

### Data layer — `src/data/dashboard.ts`
`getDashboardData(from, to)` fetches in parallel:
- Invoices in range: `*, customers(clinic_name), invoice_items(*, products(name))`,
  `invoice_date` between from/to (same shape Reports uses).
- Payments in range: `amount, payment_date` from `payments`, `payment_date` between from/to.
- Prior-period invoices: same-length window immediately before `from`;
  `total, invoice_date, customer_id` only (for growth + returning-clinic set).
- Clinic head-count (unchanged).

### Aggregation — `src/lib/dashboard.ts` (pure, unit-tested)
`summarizeDashboard({ invoices, payments, priorInvoices, range })` →
`sales, paymentsReceived, outstanding, invoiceCount, salesGrowthPct,
avgInvoiceValue, avgInvoiceValuePrior, newClinics, returningClinics,
trend[{ month, sales, payments }], byProduct, byCustomer`.

Reuse: extract `aggregateByProduct` / `aggregateByCustomer` from
`src/lib/reports.ts` into shared exported helpers; both summaries call them.

### Layout — `src/components/dashboard/DashboardClient.tsx`
Modeled on `ReportsClient`. Title + date inputs (spinner on pending), then:
1. 4 KPI cards (each with icon, value, sub-line — e.g. Sales shows `▲12% vs last period`).
2. Sales vs Payment trend chart (grouped bars, full width).
3. Two columns: Top Products + Top Clinics (horizontal bars).
4. Growth strip: new-vs-returning clinics + avg invoice value trend tiles.

The `New Invoice` button + `invoices.create` gate stay as-is.

### Edge cases
- Empty period → "No data for this period".
- Prior sales = 0 → show "new" instead of divide-by-zero %.
- Payments without an in-range invoice still count as cash collected (correct).
- Month bucketing via `date-fns` `eachMonthOfInterval` over [from, to].
