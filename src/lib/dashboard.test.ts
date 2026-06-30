import { describe, it, expect } from 'vitest'
import { summarizeDashboard, type DashboardInvoice, type DashboardPriorInvoice } from './dashboard'

// Minimal current-range invoice factory.
const di = (over: Partial<DashboardInvoice> = {}): DashboardInvoice => ({
  id: 'i1',
  invoice_number: 'INV-1',
  status: 'sent',
  total: 100,
  voided_at: null,
  invoice_date: '2026-06-01',
  due_date: '2026-06-10',
  customer_id: 'c1',
  ...over,
})

const pi = (over: Partial<DashboardPriorInvoice> = {}): DashboardPriorInvoice => ({
  total: 100,
  customer_id: 'c1',
  voided_at: null,
  ...over,
})

const RANGE = { from: '2026-06-01', to: '2026-06-30' }

describe('summarizeDashboard', () => {
  it('sums sales from non-voided invoices and cash from payment rows separately', () => {
    const r = summarizeDashboard({
      invoices: [di({ total: 200 }), di({ total: 50, voided_at: '2026-06-05T00:00:00Z' })],
      payments: [{ amount: 120, payment_date: '2026-06-10' }],
      priorInvoices: [],
      outstandingInvoices: [],
      ...RANGE,
    })
    expect(r.sales).toBe(200) // voided excluded
    expect(r.paymentsReceived).toBe(120) // real cash, independent of invoice status
    expect(r.invoiceCount).toBe(2)
  })

  it('sums outstanding from the all-time snapshot, not the range slice', () => {
    const r = summarizeDashboard({
      invoices: [di({ status: 'paid', total: 999 })], // range slice — should NOT affect outstanding
      payments: [],
      priorInvoices: [],
      outstandingInvoices: [
        { status: 'sent', total: 80, voided_at: null },
        { status: 'partial', total: 20, voided_at: null },
        { status: 'paid', total: 500, voided_at: null }, // not outstanding
        { status: 'sent', total: 40, voided_at: '2026-01-01T00:00:00Z' }, // voided
      ],
      ...RANGE,
    })
    expect(r.outstanding).toBe(100)
  })

  it('computes period-over-period sales growth, or null with no baseline', () => {
    const grown = summarizeDashboard({
      invoices: [di({ total: 150 })],
      payments: [],
      priorInvoices: [pi({ total: 100 })],
      outstandingInvoices: [],
      ...RANGE,
    })
    expect(grown.salesGrowthPct).toBeCloseTo(0.5)

    const fresh = summarizeDashboard({ invoices: [di({ total: 150 })], payments: [], priorInvoices: [], outstandingInvoices: [], ...RANGE })
    expect(fresh.salesGrowthPct).toBeNull()
  })

  it('classifies clinics as new vs returning against the prior period', () => {
    const r = summarizeDashboard({
      invoices: [di({ customer_id: 'c1' }), di({ customer_id: 'c2' })],
      payments: [],
      priorInvoices: [pi({ customer_id: 'c1' })],
      outstandingInvoices: [],
      ...RANGE,
    })
    expect(r.returningClinics).toBe(1) // c1 billed before
    expect(r.newClinics).toBe(1) // c2 is new
  })

  it('buckets sales and payments by month across the full range', () => {
    const r = summarizeDashboard({
      invoices: [di({ total: 100, invoice_date: '2026-05-15' }), di({ total: 200, invoice_date: '2026-06-15' })],
      payments: [{ amount: 80, payment_date: '2026-06-20' }],
      priorInvoices: [],
      outstandingInvoices: [],
      from: '2026-05-01',
      to: '2026-06-30',
    })
    expect(r.trend.map(t => t.month)).toEqual(['2026-05', '2026-06'])
    expect(r.trend[0]).toMatchObject({ sales: 100, payments: 0 })
    expect(r.trend[1]).toMatchObject({ sales: 200, payments: 80 })
  })

  it('computes average invoice value, guarding against empty periods', () => {
    const r = summarizeDashboard({
      invoices: [di({ total: 100 }), di({ total: 300 })],
      payments: [],
      priorInvoices: [],
      outstandingInvoices: [],
      ...RANGE,
    })
    expect(r.avgInvoiceValue).toBe(200)

    const empty = summarizeDashboard({ invoices: [], payments: [], priorInvoices: [], outstandingInvoices: [], ...RANGE })
    expect(empty.avgInvoiceValue).toBe(0)
  })
})
