import { describe, it, expect } from 'vitest'
import type { ReportInvoice, ReportPayment } from './reports'
import {
  summarizeReports,
  aggregateByCustomer,
  aggregateByProduct,
  aggregateSalesSummary,
  avgDaysToPayByClinic,
  buildReportChecks,
  hasReportExportData,
} from './reports'

// Minimal invoice factory — only the fields the summary reads.
const ri = (over: Partial<ReportInvoice> = {}): ReportInvoice => ({
  id: 'i1',
  invoice_number: 'INV-1',
  status: 'sent',
  total: 100,
  subtotal: 100,
  amount_paid: 0,
  voided_at: null,
  invoice_date: '2026-06-01',
  due_date: '2026-06-10',
  ...over,
})

const NOW = new Date('2026-06-20T00:00:00Z').getTime()

describe('summarizeReports', () => {
  it('excludes voided invoices from invoiced/customer/product totals', () => {
    const r = summarizeReports([ri({ total: 100 }), ri({ total: 50, voided_at: '2026-06-05T00:00:00Z' })], NOW)
    expect(r.totalInvoiced).toBe(100)
  })

  it('sums outstanding balances and excludes paid invoices', () => {
    const r = summarizeReports(
      [ri({ status: 'paid', total: 200 }), ri({ status: 'sent', total: 80 }), ri({ status: 'partial', total: 20 })],
      NOW,
    )
    expect(r.totalOutstanding).toBe(100)
  })

  it('nets partial payments out of outstanding, its rows, and the aging buckets', () => {
    const r = summarizeReports(
      [
        ri({ status: 'partial', total: 100, amount_paid: 80, due_date: '2026-06-10' }), // owes 20, 10d overdue
        ri({ status: 'sent', total: 50, due_date: '2026-07-01' }), // owes 50, not due
      ],
      NOW,
    )
    expect(r.totalOutstanding).toBe(70)
    expect(r.outstanding.find(i => i.status === 'partial')?.balanceDue).toBe(20)
    expect(r.agingBuckets).toMatchObject({ current: 50, d1_30: 20 })
  })

  it('computes aging days for outstanding invoices, newest-overdue first', () => {
    const r = summarizeReports(
      [ri({ due_date: '2026-06-10' }), ri({ due_date: '2026-05-21' })],
      NOW,
    )
    expect(r.outstanding[0].daysOverdue).toBe(30) // 2026-05-21 → 2026-06-20
    expect(r.outstanding[1].daysOverdue).toBe(10)
  })

  it('ages invoices by the Malaysia calendar day, not UTC elapsed hours', () => {
    const malaysiaEarlyMorning = new Date('2026-06-19T16:30:00Z').getTime() // 2026-06-20 00:30 MYT

    const r = summarizeReports([ri({ due_date: '2026-06-10' })], malaysiaEarlyMorning)

    expect(r.outstanding[0].daysOverdue).toBe(10)
    expect(r.agingBuckets.d1_30).toBe(100)
  })

  it('buckets outstanding value by age, summing to totalOutstanding', () => {
    const r = summarizeReports(
      [
        ri({ total: 10, due_date: '2026-07-01' }), // not yet due → current
        ri({ total: 20, due_date: '2026-06-10' }), // 10d → 1–30
        ri({ total: 30, due_date: '2026-05-01' }), // 50d → 31–60
        ri({ total: 40, due_date: '2026-04-01' }), // 80d → 61–90
        ri({ total: 50, due_date: '2026-01-01' }), // 170d → 90+
        ri({ total: 999, status: 'paid' }), // not outstanding — ignored
      ],
      NOW,
    )
    expect(r.agingBuckets).toEqual({ current: 10, d1_30: 20, d31_60: 30, d61_90: 40, d90plus: 50 })
    const sum = Object.values(r.agingBuckets).reduce((s, v) => s + v, 0)
    expect(sum).toBe(r.totalOutstanding)
  })

  it('counts only non-voided invoices in invoiceCount', () => {
    const r = summarizeReports(
      [ri(), ri({ voided_at: '2026-06-05T00:00:00Z' })],
      NOW,
    )
    expect(r.invoiceCount).toBe(1)
  })

  it('aggregates revenue by clinic via salesSummary (descending)', () => {
    const r = summarizeReports(
      [
        ri({ total: 100, customers: { clinic_name: 'A' } }),
        ri({ total: 300, customers: { clinic_name: 'B' } }),
        ri({ total: 50, customers: { clinic_name: 'A' } }),
      ],
      NOW,
    )
    expect(r.salesSummary.map(c => c.name)).toEqual(['B', 'A'])
    expect(r.salesSummary[1]).toMatchObject({ name: 'A', total: 150, count: 2 })
  })

  it('aggregates revenue by product, falling back to line description', () => {
    const r = summarizeReports(
      [ri({ invoice_items: [
        { description: 'Custom job', amount: 40, quantity: 1 },
        { description: 'x', amount: 60, quantity: 2, products: { name: 'Crown' } },
      ] })],
      NOW,
    )
    const names = r.byProduct.map(p => p.name)
    expect(names).toContain('Crown')
    expect(names).toContain('Custom job')
  })
})

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
    expect(r.salesSummary).toHaveLength(15)
  })
})

describe('summarizeReports sales list', () => {
  it('returns active invoices ascending by invoice_date, excluding voided', () => {
    const r = summarizeReports(
      [
        ri({ id: 'a', invoice_date: '2026-06-10' }),
        ri({ id: 'b', invoice_date: '2026-06-02' }),
        ri({ id: 'c', invoice_date: '2026-06-05', voided_at: '2026-06-06T00:00:00Z' }),
      ],
      NOW,
    )
    expect(r.sales.map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('carries subtotal through on sales rows', () => {
    const r = summarizeReports([ri({ subtotal: 80, total: 90 })], NOW)
    expect(r.sales[0].subtotal).toBe(80)
    expect(r.sales[0].total).toBe(90)
  })
})

describe('aggregateSalesSummary', () => {
  it('groups by clinic and sorts by total descending', () => {
    const rows = aggregateSalesSummary([
      ri({ total: 100, status: 'paid', customers: { clinic_name: 'A' } }),
      ri({ total: 300, status: 'sent', customers: { clinic_name: 'B' } }),
      ri({ total: 50, status: 'paid', customers: { clinic_name: 'A' } }),
    ])
    expect(rows.map(r => r.name)).toEqual(['B', 'A'])
    expect(rows[0]).toMatchObject({ name: 'B', count: 1, total: 300, paid: 0, outstanding: 300, draft: 0 })
    expect(rows[1]).toMatchObject({ name: 'A', count: 2, total: 150, paid: 150, outstanding: 0, draft: 0 })
  })

  it('partitions paid / outstanding / draft so they sum to total', () => {
    const rows = aggregateSalesSummary([
      ri({ total: 200, status: 'paid', customers: { clinic_name: 'X' } }),
      ri({ total: 80, status: 'partial', customers: { clinic_name: 'X' } }),
      ri({ total: 30, status: 'overdue', customers: { clinic_name: 'X' } }),
      ri({ total: 40, status: 'draft', customers: { clinic_name: 'X' } }),
    ])
    const x = rows[0]
    expect(x).toMatchObject({ name: 'X', count: 4, total: 350, paid: 200, outstanding: 110, draft: 40 })
    expect(x.paid + x.outstanding + x.draft).toBe(x.total)
  })

  it('splits a partially-paid invoice between paid and outstanding, keeping the invariant', () => {
    const rows = aggregateSalesSummary([
      ri({ total: 100, status: 'partial', amount_paid: 30, customers: { clinic_name: 'Y' } }),
    ])
    expect(rows[0]).toMatchObject({ name: 'Y', total: 100, paid: 30, outstanding: 70, draft: 0 })
    expect(rows[0].paid + rows[0].outstanding + rows[0].draft).toBe(rows[0].total)
  })

  it('excludes voided invoices from every column', () => {
    const rows = aggregateSalesSummary([
      ri({ total: 100, status: 'paid', customers: { clinic_name: 'A' } }),
      ri({ total: 999, status: 'paid', voided_at: '2026-06-05T00:00:00Z', customers: { clinic_name: 'A' } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'A', count: 1, total: 100, paid: 100 })
  })

  it('falls back to Unknown when the clinic name is missing', () => {
    const rows = aggregateSalesSummary([ri({ customers: null })])
    expect(rows[0].name).toBe('Unknown')
  })
})

describe('avgDaysToPayByClinic', () => {
  const pay = (over: Partial<ReportPayment> = {}): ReportPayment => ({
    amount: 100,
    payment_date: '2026-06-20',
    reference_number: null,
    invoice_id: 'inv-1',
    invoice_number: 'INV-1',
    invoice_date: '2026-06-10',
    clinic_name: 'A',
    ...over,
  })

  it('averages whole days between invoice and payment per clinic', () => {
    const r = avgDaysToPayByClinic([
      pay(), // 10 days
      pay({ payment_date: '2026-06-30' }), // 20 days
      pay({ clinic_name: 'B', payment_date: '2026-06-10' }), // same day → 0
    ])
    expect(r.A).toEqual({ payments: 2, avgDaysToPay: 15 })
    expect(r.B).toEqual({ payments: 1, avgDaysToPay: 0 })
  })

  it('skips payments missing the invoice join or clinic, clamping negatives to 0', () => {
    const r = avgDaysToPayByClinic([
      pay({ invoice_date: null }),
      pay({ clinic_name: null }),
      pay({ clinic_name: 'C', payment_date: '2026-06-05' }), // before invoice date → 0
    ])
    expect(Object.keys(r)).toEqual(['C'])
    expect(r.C.avgDaysToPay).toBe(0)
  })
})

describe('summarizeReports salesSummary', () => {
  it('populates salesSummary partitioned by payment status', () => {
    const r = summarizeReports([
      ri({ total: 200, status: 'paid', customers: { clinic_name: 'A' } }),
      ri({ total: 100, status: 'sent', customers: { clinic_name: 'A' } }),
    ], NOW)
    expect(r.salesSummary[0]).toMatchObject({ name: 'A', total: 300, paid: 200, outstanding: 100, draft: 0 })
  })
})

describe('hasReportExportData', () => {
  it('allows exports when the range only has payments', () => {
    expect(hasReportExportData({ invoiceCount: 0, paymentCount: 1 })).toBe(true)
  })

  it('disables exports only when the range has no invoices or payments', () => {
    expect(hasReportExportData({ invoiceCount: 0, paymentCount: 0 })).toBe(false)
  })
})

describe('buildReportChecks', () => {
  const payment = (over: Partial<ReportPayment> = {}): ReportPayment => ({
    amount: 100,
    payment_date: '2026-06-20',
    reference_number: null,
    invoice_id: 'i1',
    invoice_number: 'INV-1',
    invoice_date: '2026-06-01',
    clinic_name: 'A',
    ...over,
  })

  it('returns passing reconciliation checks for a consistent report', () => {
    const summary = summarizeReports([
      ri({
        id: 'paid',
        status: 'paid',
        total: 100,
        amount_paid: 100,
        invoice_items: [{ description: 'Crown', amount: 100, quantity: 1 }],
      }),
      ri({
        id: 'sent',
        status: 'sent',
        total: 50,
        amount_paid: 0,
        invoice_items: [{ description: 'Denture', amount: 50, quantity: 1 }],
      }),
    ], NOW)

    const checks = buildReportChecks(summary, [payment({ amount: 100 })])

    expect(checks.every((check) => check.ok)).toBe(true)
    expect(checks.map((check) => check.key)).toEqual([
      'sales_partition',
      'aging_total',
      'product_total',
      'cash_received',
      'paid_coverage',
    ])
  })

  it('flags a paid invoice whose recorded amount does not cover the total', () => {
    const summary = summarizeReports([
      ri({ status: 'paid', total: 160, amount_paid: 0 }),
    ], NOW)

    const paidCoverage = buildReportChecks(summary, []).find((check) => check.key === 'paid_coverage')

    expect(paidCoverage).toMatchObject({
      ok: false,
      label: 'Paid invoices have matching payments',
      detail: '1 paid invoice does not have recorded payments matching its total.',
    })
  })

  it('flags item totals that do not reconcile to total invoiced', () => {
    const summary = summarizeReports([
      ri({ total: 100, invoice_items: [{ description: 'Crown', amount: 90, quantity: 1 }] }),
    ], NOW)

    const productTotal = buildReportChecks(summary, []).find((check) => check.key === 'product_total')

    expect(productTotal).toMatchObject({
      ok: false,
      label: 'Product totals equal Total Invoiced',
    })
  })
})
