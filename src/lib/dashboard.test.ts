import { describe, it, expect } from 'vitest'
import { summarizeDashboard, type DashboardInput, type DashboardInvoice, type DashboardPriorInvoice } from './dashboard'

// Minimal current-range invoice factory.
const di = (over: Partial<DashboardInvoice> = {}): DashboardInvoice => ({
  id: 'i1',
  invoice_number: 'INV-1',
  status: 'sent',
  total: 100,
  amount_paid: 0,
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

// Every input the summary needs, with harmless defaults — tests override what they exercise.
const run = (over: Partial<DashboardInput> = {}) =>
  summarizeDashboard({
    invoices: [],
    payments: [],
    priorInvoices: [],
    lastYearInvoices: [],
    outstandingInvoices: [],
    workItems: [],
    from: '2026-06-01',
    to: '2026-06-30',
    today: '2026-06-20',
    ...over,
  })

describe('summarizeDashboard', () => {
  it('sums sales from non-voided invoices and cash from payment rows separately', () => {
    const r = run({
      invoices: [di({ total: 200 }), di({ total: 50, voided_at: '2026-06-05T00:00:00Z' })],
      payments: [{ amount: 120, payment_date: '2026-06-10' }],
    })
    expect(r.sales).toBe(200) // voided excluded
    expect(r.paymentsReceived).toBe(120) // real cash, independent of invoice status
    expect(r.invoiceCount).toBe(1) // voided invoices never count on the dashboard
  })

  it('sums outstanding from the all-time snapshot, not the range slice', () => {
    const r = run({
      invoices: [di({ status: 'paid', total: 999 })], // range slice — should NOT affect outstanding
      outstandingInvoices: [
        { status: 'sent', total: 80, voided_at: null, due_date: '2026-07-01' },
        { status: 'partial', total: 20, voided_at: null, due_date: '2026-07-01' },
        { status: 'paid', total: 500, voided_at: null, due_date: '2026-07-01' }, // not outstanding
        { status: 'sent', total: 40, voided_at: '2026-01-01T00:00:00Z', due_date: '2026-07-01' }, // voided
      ],
    })
    expect(r.outstanding).toBe(100)
  })

  it('splits out the overdue count and amount using the reference day', () => {
    const r = run({
      outstandingInvoices: [
        { status: 'sent', total: 80, voided_at: null, due_date: '2026-06-01' }, // past due
        { status: 'overdue', total: 30, voided_at: null, due_date: '2026-05-01' }, // past due
        { status: 'sent', total: 500, voided_at: null, due_date: '2026-07-01' }, // not yet due
        { status: 'sent', total: 99, voided_at: null, due_date: '2026-06-20' }, // due today — not overdue
      ],
    })
    expect(r.overdueCount).toBe(2)
    expect(r.overdueAmount).toBe(110)
  })

  it('nets partial payments out of outstanding and overdue amounts', () => {
    const r = run({
      outstandingInvoices: [
        { status: 'partial', total: 100, amount_paid: 80, voided_at: null, due_date: '2026-06-01' }, // owes 20, overdue
        { status: 'sent', total: 50, voided_at: null, due_date: '2026-07-01' }, // owes 50, not due
      ],
    })
    expect(r.outstanding).toBe(70)
    expect(r.overdueCount).toBe(1)
    expect(r.overdueAmount).toBe(20)
  })

  it('computes period-over-period sales growth, or null with no baseline', () => {
    const grown = run({ invoices: [di({ total: 150 })], priorInvoices: [pi({ total: 100 })] })
    expect(grown.salesGrowthPct).toBeCloseTo(0.5)

    const fresh = run({ invoices: [di({ total: 150 })] })
    expect(fresh.salesGrowthPct).toBeNull()
  })

  it('computes year-over-year growth from the same window last year, excluding voided', () => {
    const r = run({
      invoices: [di({ total: 260 })],
      lastYearInvoices: [pi({ total: 200 }), pi({ total: 999, voided_at: '2025-06-05T00:00:00Z' })],
    })
    expect(r.salesYoYPct).toBeCloseTo(0.3)

    const noBaseline = run({ invoices: [di({ total: 260 })] })
    expect(noBaseline.salesYoYPct).toBeNull()
  })

  it('computes collection rate as cash ÷ sales, null when nothing billed', () => {
    const r = run({
      invoices: [di({ total: 200 })],
      payments: [{ amount: 150, payment_date: '2026-06-10' }],
    })
    expect(r.collectionRate).toBeCloseTo(0.75)

    const noSales = run({ payments: [{ amount: 150, payment_date: '2026-06-10' }] })
    expect(noSales.collectionRate).toBeNull()
  })

  it('averages days from invoice to payment, ignoring payments without an invoice date', () => {
    const r = run({
      payments: [
        { amount: 100, payment_date: '2026-06-20', invoice_date: '2026-06-10' }, // 10 days
        { amount: 100, payment_date: '2026-06-30', invoice_date: '2026-06-10' }, // 20 days
        { amount: 100, payment_date: '2026-06-30', invoice_date: null }, // no join — skipped
      ],
    })
    expect(r.avgDaysToCollect).toBe(15)

    const none = run({ payments: [{ amount: 100, payment_date: '2026-06-30', invoice_date: null }] })
    expect(none.avgDaysToCollect).toBeNull()
  })

  it('counts jobs on the floor by work status, excluding delivered', () => {
    const r = run({
      workItems: [
        { work_status: 'received' },
        { work_status: 'in_progress' },
        { work_status: 'in_progress' },
        { work_status: 'ready' },
        { work_status: 'on_hold' },
        { work_status: 'delivered' }, // not WIP
      ],
    })
    expect(r.wip).toEqual({ received: 1, inProgress: 2, ready: 1, onHold: 1, total: 5 })
  })

  it('classifies clinics as new vs returning against the prior period', () => {
    const r = run({
      invoices: [di({ customer_id: 'c1' }), di({ customer_id: 'c2' })],
      priorInvoices: [pi({ customer_id: 'c1' })],
    })
    expect(r.returningClinics).toBe(1) // c1 billed before
    expect(r.newClinics).toBe(1) // c2 is new
  })

  it('buckets sales and payments by month across the full range', () => {
    const r = run({
      invoices: [di({ total: 100, invoice_date: '2026-05-15' }), di({ total: 200, invoice_date: '2026-06-15' })],
      payments: [{ amount: 80, payment_date: '2026-06-20' }],
      from: '2026-05-01',
      to: '2026-06-30',
    })
    expect(r.trend.map(t => t.month)).toEqual(['2026-05', '2026-06'])
    expect(r.trend[0]).toMatchObject({ sales: 100, payments: 0 })
    expect(r.trend[1]).toMatchObject({ sales: 200, payments: 80 })
  })

  it('computes average invoice value, guarding against empty periods', () => {
    const r = run({ invoices: [di({ total: 100 }), di({ total: 300 })] })
    expect(r.avgInvoiceValue).toBe(200)

    const empty = run()
    expect(empty.avgInvoiceValue).toBe(0)
  })
})
