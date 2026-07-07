import { describe, expect, it } from 'vitest'
import { normalizeDashboardPayments } from './dashboard'

describe('normalizeDashboardPayments', () => {
  const payment = (over: Record<string, unknown> = {}) => ({
    amount: 120,
    payment_date: '2026-06-10',
    invoices: {
      invoice_date: '2026-06-01',
      voided_at: null,
      deleted_at: null,
    },
    ...over,
  })

  it('drops payments attached to voided or soft-deleted invoices', () => {
    const payments = normalizeDashboardPayments([
      payment(),
      payment({
        amount: 80,
        invoices: {
          invoice_date: '2026-06-01',
          voided_at: '2026-06-03T00:00:00Z',
          deleted_at: null,
        },
      }),
      payment({
        amount: 90,
        invoices: {
          invoice_date: '2026-06-01',
          voided_at: null,
          deleted_at: '2026-06-04T00:00:00Z',
        },
      }),
      payment({ amount: 50, invoices: null }),
    ])

    expect(payments).toEqual([
      { amount: 120, payment_date: '2026-06-10', invoice_date: '2026-06-01' },
      { amount: 50, payment_date: '2026-06-10', invoice_date: null },
    ])
  })
})
