import { describe, it, expect } from 'vitest'
import type { ReportInvoice } from './reports'
import { summarizeReports, aggregateByCustomer, aggregateByProduct, aggregateSalesSummary } from './reports'

// Minimal invoice factory — only the fields the summary reads.
const ri = (over: Partial<ReportInvoice> = {}): ReportInvoice => ({
  id: 'i1',
  invoice_number: 'INV-1',
  status: 'sent',
  total: 100,
  subtotal: 100,
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

  it('sums collected (paid, non-voided) and outstanding separately', () => {
    const r = summarizeReports(
      [ri({ status: 'paid', total: 200 }), ri({ status: 'sent', total: 80 }), ri({ status: 'partial', total: 20 })],
      NOW,
    )
    expect(r.totalPaidInvoices).toBe(200)
    expect(r.totalOutstanding).toBe(100)
  })

  it('computes aging days for outstanding invoices, newest-overdue first', () => {
    const r = summarizeReports(
      [ri({ due_date: '2026-06-10' }), ri({ due_date: '2026-05-21' })],
      NOW,
    )
    expect(r.outstanding[0].daysOverdue).toBe(30) // 2026-05-21 → 2026-06-20
    expect(r.outstanding[1].daysOverdue).toBe(10)
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

describe('summarizeReports salesSummary', () => {
  it('populates salesSummary partitioned by payment status', () => {
    const r = summarizeReports([
      ri({ total: 200, status: 'paid', customers: { clinic_name: 'A' } }),
      ri({ total: 100, status: 'sent', customers: { clinic_name: 'A' } }),
    ], NOW)
    expect(r.salesSummary[0]).toMatchObject({ name: 'A', total: 300, paid: 200, outstanding: 100, draft: 0 })
  })
})
