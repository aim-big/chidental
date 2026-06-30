# Sales Reports & CSV Export Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date-range presets and full By-Clinic/By-Product breakdowns to the `/reports` page, and make the CSV export a clean, full whole-report file.

**Architecture:** Keep the existing server-first flow (`page.tsx` → `summarizeReports` → `ReportsClient`). Pure logic lives in testable `lib/` modules (`reports.ts`, new `reports-presets.ts`, rewritten `reports-csv.ts`); `ReportsClient` composes them and owns navigation + the download. The server computes preset ranges and passes them as a prop so the client never calls `new Date()` during render (no hydration mismatch).

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, React, Tailwind/shadcn, recharts, date-fns v4, Vitest.

## Global Constraints

- Dev server runs on **http://localhost:6060** (`npm run dev`); do not assume 3000.
- UI copy always says **"Clinic"**; code/DB/types/routes stay `customer`. (CONVENTIONS.md)
- **No new dependencies.** Export stays CSV-only — no PDF, no Excel.
- **Verification gates: only `npm run build` and `npm test` work.** `tsc` and `lint` are unusable in this project — do not rely on them.
- Vitest runs in the **node** environment and only matches **`src/**/*.test.ts`** (no `.tsx`, no jsdom). Pure logic gets unit tests; client-component wiring is verified with `npm run build` + manual browser check.
- CSV money is formatted to exactly **2 decimals** (e.g. `1800.00`) but stays a plain number (no `RM`, no thousands separators). Dates stay ISO `yyyy-MM-dd`.
- The aggregation helpers `aggregateByCustomer` / `aggregateByProduct` are shared with `src/lib/dashboard.ts`; their **default top-10 behaviour must not change** (dashboard must stay top-10).
- Work happens on the existing `reports-export-improvements` branch.

---

## File Structure

- `src/lib/reports.ts` *(modify)* — add optional `limit` to the two aggregators; `summarizeReports` returns full breakdowns.
- `src/lib/reports-presets.ts` *(create)* — pure preset math: `presetRange`, `buildPresets`, `matchPreset`, `PRESET_LABELS`.
- `src/lib/reports-presets.test.ts` *(create)* — unit tests for the preset module.
- `src/lib/reports-csv.ts` *(rewrite)* — clean whole-report CSV; `buildReportCsv` gains a `generatedOn` arg.
- `src/lib/reports-csv.test.ts` *(modify)* — assert title block, 2-dp money, full breakdowns, totals.
- `src/lib/reports.test.ts` *(modify)* — assert the `limit` param + full breakdowns from `summarizeReports`.
- `src/app/(authenticated)/reports/page.tsx` *(modify)* — build preset ranges from `now`, pass as a prop.
- `src/components/reports/ReportsClient.tsx` *(modify)* — preset button row; full breakdown tables; pass `todayISODate()` + `generatedOn` to the CSV.

---

### Task 1: Full breakdowns in the aggregators

**Files:**
- Modify: `src/lib/reports.ts`
- Test: `src/lib/reports.test.ts`

**Interfaces:**
- Consumes: existing `ReportInvoice`, `CustomerAgg`, `ProductAgg`, `ReportSummary`.
- Produces:
  - `aggregateByCustomer(invoices: ReportInvoice[], limit?: number): CustomerAgg[]` (default `limit = 10`)
  - `aggregateByProduct(invoices: ReportInvoice[], limit?: number): ProductAgg[]` (default `limit = 10`)
  - `summarizeReports(...)` now returns **all** rows in `byCustomer` / `byProduct`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/reports.test.ts` (inside the file, after the existing `describe`):

```ts
import { aggregateByCustomer, aggregateByProduct } from './reports'

describe('aggregation limit', () => {
  const clinics = Array.from({ length: 15 }, (_, i) =>
    ri({ total: i + 1, customers: { clinic_name: `C${i}` } }),
  )
  const products = Array.from({ length: 15 }, (_, i) =>
    ri({ invoice_items: [{ description: `P${i}`, amount: i + 1, quantity: 1 }] }),
  )

  it('aggregateByCustomer defaults to top 10', () => {
    expect(aggregateByCustomer(clinics)).toHaveLength(10)
  })
  it('aggregateByCustomer returns all rows when limit is Infinity', () => {
    expect(aggregateByCustomer(clinics, Infinity)).toHaveLength(15)
  })
  it('aggregateByProduct defaults to top 10', () => {
    expect(aggregateByProduct(products)).toHaveLength(10)
  })
  it('aggregateByProduct returns all rows when limit is Infinity', () => {
    expect(aggregateByProduct(products, Infinity)).toHaveLength(15)
  })
  it('summarizeReports returns full breakdowns, not just top 10', () => {
    const r = summarizeReports(clinics, NOW)
    expect(r.byCustomer).toHaveLength(15)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reports.test.ts`
Expected: FAIL — `summarizeReports` returns 10, not 15 (and the aggregators ignore the second arg).

- [ ] **Step 3: Add the `limit` param and use it in `summarizeReports`**

In `src/lib/reports.ts`, change the two aggregator signatures and their final `.slice(...)`:

```ts
export function aggregateByCustomer(invoices: ReportInvoice[], limit = 10): CustomerAgg[] {
  return Object.values(
    invoices.reduce<Record<string, CustomerAgg>>((acc, inv) => {
      const name = inv.customers?.clinic_name ?? 'Unknown'
      if (!acc[name]) acc[name] = { name, total: 0, count: 0 }
      acc[name].total += Number(inv.total)
      acc[name].count += 1
      return acc
    }, {}),
  ).sort((a, b) => b.total - a.total).slice(0, limit)
}
```

```ts
export function aggregateByProduct(invoices: ReportInvoice[], limit = 10): ProductAgg[] {
  const map: Record<string, ProductAgg> = {}
  invoices.forEach((inv) => {
    ;(inv.invoice_items ?? []).forEach((item) => {
      const name = item.products?.name ?? item.description
      if (!map[name]) map[name] = { name, total: 0, qty: 0 }
      map[name].total += Number(item.amount)
      map[name].qty += Number(item.quantity)
    })
  })
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, limit)
}
```

In `summarizeReports`, change the two breakdown calls to request all rows:

```ts
  const byCustomer = aggregateByCustomer(active, Infinity)
  const byProduct = aggregateByProduct(active, Infinity)
```

(`Array.prototype.slice(0, Infinity)` returns every element.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/reports.test.ts`
Expected: PASS (all existing + new tests). The existing top-10 tests still pass because the default is `10`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports.ts src/lib/reports.test.ts
git commit -m "feat(reports): full By-Clinic/By-Product breakdowns via limit param

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Date-range preset module

**Files:**
- Create: `src/lib/reports-presets.ts`
- Test: `src/lib/reports-presets.test.ts`

**Interfaces:**
- Produces:
  - `type PresetKind = 'month' | 'lastMonth' | 'quarter' | 'ytd'`
  - `type DateRange = { from: string; to: string }`
  - `type PresetMap = Record<PresetKind, DateRange>`
  - `presetRange(kind: PresetKind, now: Date): DateRange`
  - `buildPresets(now: Date): PresetMap`
  - `matchPreset(from: string, to: string, presets: PresetMap): PresetKind | 'custom'`
  - `PRESET_LABELS: Record<PresetKind, string>` (insertion order = display order)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reports-presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { presetRange, buildPresets, matchPreset } from './reports-presets'

// Local-time construction; date-fns + format() are local, so assertions are
// timezone-independent (all comparisons happen on yyyy-MM-dd strings).
const NOW = new Date('2026-06-15T10:00:00')

describe('presetRange', () => {
  it('this month', () => {
    expect(presetRange('month', NOW)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })
  it('last month', () => {
    expect(presetRange('lastMonth', NOW)).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })
  it('this quarter (Q2 Apr–Jun)', () => {
    expect(presetRange('quarter', NOW)).toEqual({ from: '2026-04-01', to: '2026-06-30' })
  })
  it('year to date ends today', () => {
    expect(presetRange('ytd', NOW)).toEqual({ from: '2026-01-01', to: '2026-06-15' })
  })
})

describe('matchPreset', () => {
  const presets = buildPresets(NOW)
  it('round-trips each named preset', () => {
    for (const k of ['month', 'lastMonth', 'quarter', 'ytd'] as const) {
      expect(matchPreset(presets[k].from, presets[k].to, presets)).toBe(k)
    }
  })
  it('returns custom for an arbitrary range', () => {
    expect(matchPreset('2026-06-03', '2026-06-09', presets)).toBe('custom')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reports-presets.test.ts`
Expected: FAIL — module `./reports-presets` does not exist.

- [ ] **Step 3: Write the module**

Create `src/lib/reports-presets.ts`:

```ts
// Pure date-range preset math for the Sales Reports page. No React/DOM so it
// stays unit-testable. The server builds the ranges from its `now` and passes
// them to the client, so the client never calls `new Date()` during render.

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  subMonths,
} from 'date-fns'

export type PresetKind = 'month' | 'lastMonth' | 'quarter' | 'ytd'
export type DateRange = { from: string; to: string }
export type PresetMap = Record<PresetKind, DateRange>

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

// Display order matters: Object.keys() preserves insertion order, and the
// client renders buttons in that order.
export const PRESET_LABELS: Record<PresetKind, string> = {
  month: 'This month',
  lastMonth: 'Last month',
  quarter: 'This quarter',
  ytd: 'Year to date',
}

export function presetRange(kind: PresetKind, now: Date): DateRange {
  switch (kind) {
    case 'month':
      return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) }
    case 'lastMonth': {
      const prev = subMonths(now, 1)
      return { from: iso(startOfMonth(prev)), to: iso(endOfMonth(prev)) }
    }
    case 'quarter':
      return { from: iso(startOfQuarter(now)), to: iso(endOfQuarter(now)) }
    case 'ytd':
      return { from: iso(startOfYear(now)), to: iso(now) }
  }
}

export function buildPresets(now: Date): PresetMap {
  return {
    month: presetRange('month', now),
    lastMonth: presetRange('lastMonth', now),
    quarter: presetRange('quarter', now),
    ytd: presetRange('ytd', now),
  }
}

// The preset whose range exactly equals {from,to}, or 'custom' if none match.
export function matchPreset(from: string, to: string, presets: PresetMap): PresetKind | 'custom' {
  for (const kind of Object.keys(presets) as PresetKind[]) {
    if (presets[kind].from === from && presets[kind].to === to) return kind
  }
  return 'custom'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/reports-presets.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports-presets.ts src/lib/reports-presets.test.ts
git commit -m "feat(reports): pure date-range preset module

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Clean, full CSV builder

**Files:**
- Rewrite: `src/lib/reports-csv.ts`
- Test: `src/lib/reports-csv.test.ts`

**Interfaces:**
- Consumes: `ReportSummary` (with full `byCustomer`/`byProduct` from Task 1), `paymentStatusLabel`, `COMPANY` from `@/lib/config`.
- Produces:
  - `buildReportCsv(summary: ReportSummary, range: { from: string; to: string }, generatedOn: string): string`
  - `reportCsvFilename(range: { from: string; to: string }): string` (unchanged)

- [ ] **Step 1: Update the tests (they will fail)**

Replace the body of `src/lib/reports-csv.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { buildReportCsv, reportCsvFilename } from './reports-csv'
import type { ReportSummary } from './reports'

const summary: ReportSummary = {
  totalInvoiced: 15180,
  totalPaidInvoices: 160,
  totalOutstanding: 15020,
  invoiceCount: 14,
  outstanding: [
    {
      id: 'o1',
      invoice_number: 'INV-2026-0015',
      status: 'sent',
      total: 1800,
      voided_at: null,
      invoice_date: '2026-06-08',
      due_date: '2026-07-08',
      customers: { clinic_name: 'Dr Ray & Partners Dental Clinic' },
      daysOverdue: -8,
    },
  ],
  paid: [
    {
      id: 'p1',
      invoice_number: 'INV-2026-0001',
      status: 'paid',
      total: 160,
      voided_at: null,
      invoice_date: '2026-06-02',
      due_date: '2026-06-12',
      customers: { clinic_name: 'Origin Dental Clinic' },
    },
  ],
  byCustomer: [
    { name: 'Origin Dental Clinic', total: 4500, count: 2 },
    { name: 'Dr Ray & Partners Dental Clinic', total: 1800, count: 1 },
  ],
  byProduct: [{ name: 'Zirconia Crown', total: 3000, qty: 5 }],
}

const range = { from: '2026-06-01', to: '2026-06-30' }
const GENERATED = '2026-06-30'

describe('buildReportCsv', () => {
  it('writes the title block with company, range, and generated date', () => {
    const csv = buildReportCsv(summary, range, GENERATED)
    expect(csv).toContain('Chi Dental Lab')
    expect(csv).toContain('Sales Report')
    expect(csv).toContain('Range,2026-06-01 to 2026-06-30')
    expect(csv).toContain('Generated,2026-06-30')
  })

  it('emits the summary as a Metric,Value table with 2-dp money', () => {
    const csv = buildReportCsv(summary, range, GENERATED)
    expect(csv).toContain('Metric,Value')
    expect(csv).toContain('Total Invoiced,15180.00')
    expect(csv).toContain('Collected (Paid),160.00')
    expect(csv).toContain('Outstanding,15020.00')
    expect(csv).toContain('Invoice Count,14')
  })

  it('writes outstanding rows (2-dp amount, ISO date, friendly status) + subtotal', () => {
    const csv = buildReportCsv(summary, range, GENERATED)
    expect(csv).toContain('INV-2026-0015,Dr Ray & Partners Dental Clinic,2026-07-08,-8,1800.00,Issued')
    expect(csv).toContain('Subtotal,,,,15020.00,')
    expect(csv).not.toContain('RM')
  })

  it('writes paid rows + subtotal', () => {
    const csv = buildReportCsv(summary, range, GENERATED)
    expect(csv).toContain('INV-2026-0001,Origin Dental Clinic,2026-06-02,160.00,Paid')
    expect(csv).toContain('Subtotal,,,160.00,')
  })

  it('writes the FULL By-Clinic breakdown (all rows) with a Total', () => {
    const csv = buildReportCsv(summary, range, GENERATED)
    expect(csv).toContain('Revenue by Clinic')
    expect(csv).toContain('Origin Dental Clinic,2,4500.00')
    expect(csv).toContain('Dr Ray & Partners Dental Clinic,1,1800.00')
    expect(csv).toContain('Total,3,6300.00')
  })

  it('writes the By-Product breakdown with a Total', () => {
    const csv = buildReportCsv(summary, range, GENERATED)
    expect(csv).toContain('Revenue by Product')
    expect(csv).toContain('Zirconia Crown,5,3000.00')
    expect(csv).toContain('Total,5,3000.00')
  })

  it('quotes fields that contain commas or quotes', () => {
    const csv = buildReportCsv(
      { ...summary, byProduct: [{ name: 'Crown, "Premium"', total: 10, qty: 1 }] },
      range,
      GENERATED,
    )
    expect(csv).toContain('"Crown, ""Premium""",1,10.00')
  })

  it('uses CRLF line endings', () => {
    expect(buildReportCsv(summary, range, GENERATED)).toContain('\r\n')
  })

  it('handles empty sections without crashing', () => {
    const empty: ReportSummary = {
      totalInvoiced: 0,
      totalPaidInvoices: 0,
      totalOutstanding: 0,
      invoiceCount: 0,
      outstanding: [],
      paid: [],
      byCustomer: [],
      byProduct: [],
    }
    const csv = buildReportCsv(empty, range, GENERATED)
    expect(csv).toContain('Total Invoiced,0.00')
    expect(csv).toContain('Revenue by Clinic')
    expect(csv).toContain('Total,0,0.00')
  })
})

describe('reportCsvFilename', () => {
  it('includes the date range', () => {
    expect(reportCsvFilename(range)).toBe('sales-report_2026-06-01_2026-06-30.csv')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/reports-csv.test.ts`
Expected: FAIL — `buildReportCsv` currently takes 2 args and emits the old format (no title block, integer money, no subtotals/totals).

- [ ] **Step 3: Rewrite the builder**

Replace the entire contents of `src/lib/reports-csv.ts` with:

```ts
// Builds the Sales Reports page as a single clean, downloadable CSV. Pure (no
// DOM/Blob) so it's unit-testable; the client island handles the download.
// Money is 2-dp (still a plain number Excel can sum) and dates are ISO. Sections
// carry titles, header rows, and totals; breakdowns include every row.

import type { ReportSummary } from './reports'
import { paymentStatusLabel } from './status-badge'
import { COMPANY } from './config'

// RFC 4180 field escaping: wrap in quotes when the value contains a comma,
// quote, or newline, doubling any embedded quotes.
function csvField(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function row(fields: Array<string | number>): string {
  return fields.map(csvField).join(',')
}

// Consistent 2-decimal money; still a plain number for spreadsheet math.
const money = (n: number): string => Number(n).toFixed(2)

export function reportCsvFilename(range: { from: string; to: string }): string {
  return `sales-report_${range.from}_${range.to}.csv`
}

export function buildReportCsv(
  summary: ReportSummary,
  range: { from: string; to: string },
  generatedOn: string,
): string {
  const { totalInvoiced, totalPaidInvoices, totalOutstanding, invoiceCount, outstanding, paid, byCustomer, byProduct } =
    summary
  const lines: string[] = []

  // Title block
  lines.push(row([COMPANY.name]))
  lines.push(row(['Sales Report']))
  lines.push(row(['Range', `${range.from} to ${range.to}`]))
  lines.push(row(['Generated', generatedOn]))
  lines.push('')

  // Summary
  lines.push(row(['Summary']))
  lines.push(row(['Metric', 'Value']))
  lines.push(row(['Total Invoiced', money(totalInvoiced)]))
  lines.push(row(['Collected (Paid)', money(totalPaidInvoices)]))
  lines.push(row(['Outstanding', money(totalOutstanding)]))
  lines.push(row(['Invoice Count', invoiceCount]))
  lines.push('')

  // Outstanding invoices (full list + subtotal)
  lines.push(row(['Outstanding Invoices']))
  lines.push(row(['Invoice #', 'Clinic', 'Due Date', 'Days Overdue', 'Amount', 'Status']))
  for (const inv of outstanding) {
    lines.push(
      row([
        inv.invoice_number,
        inv.customers?.clinic_name ?? '',
        inv.due_date,
        inv.daysOverdue,
        money(Number(inv.total)),
        paymentStatusLabel(inv.status),
      ]),
    )
  }
  lines.push(row(['Subtotal', '', '', '', money(totalOutstanding), '']))
  lines.push('')

  // Paid invoices (full list + subtotal)
  lines.push(row(['Paid Invoices']))
  lines.push(row(['Invoice #', 'Clinic', 'Invoice Date', 'Amount', 'Status']))
  for (const inv of paid) {
    lines.push(
      row([
        inv.invoice_number,
        inv.customers?.clinic_name ?? '',
        inv.invoice_date,
        money(Number(inv.total)),
        paymentStatusLabel(inv.status),
      ]),
    )
  }
  lines.push(row(['Subtotal', '', '', money(totalPaidInvoices), '']))
  lines.push('')

  // Revenue by clinic (all rows + total)
  lines.push(row(['Revenue by Clinic']))
  lines.push(row(['Clinic', 'Invoices', 'Total']))
  let clinicCount = 0
  let clinicTotal = 0
  for (const c of byCustomer) {
    lines.push(row([c.name, c.count, money(c.total)]))
    clinicCount += c.count
    clinicTotal += c.total
  }
  lines.push(row(['Total', clinicCount, money(clinicTotal)]))
  lines.push('')

  // Revenue by product (all rows + total)
  lines.push(row(['Revenue by Product']))
  lines.push(row(['Product', 'Quantity', 'Total']))
  let productQty = 0
  let productTotal = 0
  for (const p of byProduct) {
    lines.push(row([p.name, p.qty, money(p.total)]))
    productQty += p.qty
    productTotal += p.total
  }
  lines.push(row(['Total', productQty, money(productTotal)]))

  return lines.join('\r\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/reports-csv.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports-csv.ts src/lib/reports-csv.test.ts
git commit -m "feat(reports): cleaner whole-report CSV (title block, 2-dp money, full breakdowns, totals)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire the report page (presets prop + breakdown tables + CSV arg)

**Files:**
- Modify: `src/app/(authenticated)/reports/page.tsx`
- Modify: `src/components/reports/ReportsClient.tsx`

**Interfaces:**
- Consumes: `buildPresets`/`matchPreset`/`PRESET_LABELS`/`PresetKind`/`PresetMap` (Task 2), `buildReportCsv` 3-arg form (Task 3), full `summary.byCustomer`/`byProduct` (Task 1), `todayISODate` from `@/lib/utils`.
- Produces: `ReportsClient` now takes a `presets: PresetMap` prop.

> No unit test: `ReportsClient` is a `.tsx` client component and the Vitest config excludes `.tsx` / has no DOM env. Verify with `npm run build` + the browser harness (per Global Constraints).

- [ ] **Step 1: Pass preset ranges from the server**

In `src/app/(authenticated)/reports/page.tsx`:

Add the import (next to the other `@/lib` imports):

```ts
import { buildPresets } from '@/lib/reports-presets'
```

Then build the presets from the existing `now` and pass them to the client. Replace the final return:

```tsx
  const invoices = await getReportInvoices(from, to)
  const summary = summarizeReports(invoices, now.getTime())
  const presets = buildPresets(now)

  return <ReportsClient from={from} to={to} summary={summary} presets={presets} />
```

- [ ] **Step 2: Update ReportsClient imports and signature**

In `src/components/reports/ReportsClient.tsx`:

Change the utils import to add `todayISODate`:

```ts
import { formatCurrency, formatDate, todayISODate } from '@/lib/utils'
```

Add the presets import (after the `reports-csv` import on line 17):

```ts
import { matchPreset, PRESET_LABELS, type PresetKind, type PresetMap } from '@/lib/reports-presets'
```

Change the component signature to accept `presets`:

```tsx
export function ReportsClient({ from, to, summary, presets }: { from: string; to: string; summary: ReportSummary; presets: PresetMap }) {
```

- [ ] **Step 3: Pass the generated date into the CSV**

In the `exportCsv` function, change the `buildReportCsv` call to pass today's date:

```tsx
    const csv = buildReportCsv(summary, { from, to }, todayISODate())
```

- [ ] **Step 4: Add the preset button row**

Immediately after the destructuring line `const { totalInvoiced, ... } = summary`, compute the active preset:

```tsx
  const activeRange = matchPreset(from, to, presets)
```

Then, inside the JSX, insert a preset row directly **above** the existing `{/* Date range */}` block:

```tsx
      {/* Quick range presets */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PRESET_LABELS) as PresetKind[]).map(kind => (
          <Button
            key={kind}
            size="sm"
            variant={activeRange === kind ? 'default' : 'outline'}
            onClick={() => setRange(presets[kind])}
          >
            {PRESET_LABELS[kind]}
          </Button>
        ))}
        <Button size="sm" variant={activeRange === 'custom' ? 'default' : 'outline'} className="pointer-events-none">
          Custom
        </Button>
      </div>
```

- [ ] **Step 5: Add the full By-Clinic table under its chart**

In the `customers` `TabsContent`, the chart currently uses `data={byCustomer}`. Change it to the top-10 slice and add a full table. Replace the `<CardContent>` body of the customers tab with:

```tsx
            <CardContent>
              {byCustomer.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={byCustomer.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => `RM${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="total" fill={BRAND_CHART} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-6 overflow-x-auto">
                    <p className="text-sm font-medium text-muted-foreground mb-2">All clinics</p>
                    <Table className="min-w-[28rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Clinic</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byCustomer.map(c => (
                          <TableRow key={c.name}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell className="text-right">{c.count}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(c.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{byCustomer.reduce((s, c) => s + c.count, 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(byCustomer.reduce((s, c) => s + c.total, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : <p className="text-center text-muted-foreground py-8">No data for this period</p>}
            </CardContent>
```

- [ ] **Step 6: Add the full By-Product table under its chart**

In the `products` `TabsContent`, replace the `<CardContent>` body with:

```tsx
            <CardContent>
              {byProduct.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={byProduct.slice(0, 10)} layout="vertical" margin={{ left: 160 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => `RM${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="total" fill={BRAND_CHART_SOFT} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-6 overflow-x-auto">
                    <p className="text-sm font-medium text-muted-foreground mb-2">All products</p>
                    <Table className="min-w-[28rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byProduct.map(p => (
                          <TableRow key={p.name}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell className="text-right">{p.qty}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(p.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{byProduct.reduce((s, p) => s + p.qty, 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(byProduct.reduce((s, p) => s + p.total, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : <p className="text-center text-muted-foreground py-8">No data for this period</p>}
            </CardContent>
```

- [ ] **Step 7: Build to verify it compiles**

Run: `npm run build`
Expected: `✓ Compiled successfully`, and `/reports` listed in the route table with no type errors.

- [ ] **Step 8: Manual browser verification**

Run the dev server (`npm run dev`, port 6060) and, with the browser harness:
- Open `http://localhost:6060/reports`.
- Click each preset (This month / Last month / This quarter / Year to date) and confirm the From/To inputs update, the data reloads, and the clicked button is highlighted; edit a date by hand and confirm "Custom" highlights.
- Open the By Clinic and By Product tabs; confirm the chart still shows (top 10) and a full table with a Total row appears beneath.
- Click "Export CSV"; open the file and confirm the title block, 2-dp money, full breakdowns, and totals.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(authenticated)/reports/page.tsx" src/components/reports/ReportsClient.tsx
git commit -m "feat(reports): date-range presets + full breakdown tables; pass generated date to CSV

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: PASS — all suites, including `reports`, `reports-presets`, `reports-csv`, and the untouched `dashboard` tests (dashboard still top-10).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Update the design doc status**

In `docs/superpowers/specs/2026-06-30-reports-and-export-improvements-design.md`, change `Status: Approved (pending spec review)` to `Status: Implemented`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-30-reports-and-export-improvements-design.md
git commit -m "docs(reports): mark reports/export improvements design implemented

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Date-range presets → Task 2 (logic) + Task 4 Step 4 (UI). ✅
- Full By-Clinic/By-Product breakdowns → Task 1 (data) + Task 4 Steps 5–6 (tables). ✅
- Clean richer CSV → Task 3. ✅
- Dashboard unaffected → Task 1 keeps default `limit = 10`; Task 5 Step 1 re-runs dashboard tests. ✅
- No new deps / CSV-only / build+test gates / 2-dp money → Global Constraints; enforced in Tasks 3 & 5. ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✅

**Type consistency:** `PresetKind`/`PresetMap`/`DateRange`, `buildPresets`/`matchPreset`/`PRESET_LABELS` match between Task 2, `page.tsx`, and `ReportsClient`. `buildReportCsv(summary, range, generatedOn)` 3-arg form matches between Task 3 and Task 4 Step 3. `aggregateBy*` `limit` param matches Task 1 definition and `summarizeReports` usage. ✅
