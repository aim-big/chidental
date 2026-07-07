import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  rows: [] as unknown[],
  calls: [] as Array<{ method: string; args: unknown[] }>,
}))

vi.mock('@/lib/supabase/server', () => {
  const result = () => Promise.resolve({ data: mock.rows, error: null })
  const query = () => {
    const q: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        mock.calls.push({ method: 'select', args })
        return q
      },
      is: (...args: unknown[]) => {
        mock.calls.push({ method: 'is', args })
        return q
      },
      gte: (...args: unknown[]) => {
        mock.calls.push({ method: 'gte', args })
        return q
      },
      lte: (...args: unknown[]) => {
        mock.calls.push({ method: 'lte', args })
        return q
      },
      order: (...args: unknown[]) => {
        mock.calls.push({ method: 'order', args })
        return result()
      },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        result().then(resolve, reject),
    }
    return q
  }

  return {
    createClient: async () => ({
      from: (...args: unknown[]) => {
        mock.calls.push({ method: 'from', args })
        return query()
      },
    }),
  }
})

import { getReportInvoices, getReportPayments } from './reports'

beforeEach(() => {
  mock.rows = []
  mock.calls = []
})

describe('getReportInvoices', () => {
  it('uses an inclusive invoice-date range and hides soft-deleted invoices', async () => {
    await getReportInvoices('2026-06-01', '2026-06-30')

    expect(mock.calls).toContainEqual({ method: 'from', args: ['invoices'] })
    expect(mock.calls).toContainEqual({ method: 'is', args: ['deleted_at', null] })
    expect(mock.calls).toContainEqual({ method: 'gte', args: ['invoice_date', '2026-06-01'] })
    expect(mock.calls).toContainEqual({ method: 'lte', args: ['invoice_date', '2026-06-30'] })
  })
})

describe('getReportPayments', () => {
  const payment = (over: Record<string, unknown> = {}) => ({
    amount: 160,
    payment_date: '2026-06-02',
    reference_number: 'TRF-8841',
    invoice_id: 'inv-visible',
    invoices: {
      invoice_number: 'INV-2026-0001',
      invoice_date: '2026-06-01',
      voided_at: null,
      deleted_at: null,
      customers: { clinic_name: 'Origin Dental Clinic' },
    },
    ...over,
  })

  it('uses an inclusive payment-date range, ordered by payment date', async () => {
    await getReportPayments('2026-06-01', '2026-06-30')

    expect(mock.calls).toContainEqual({ method: 'from', args: ['payments'] })
    expect(mock.calls).toContainEqual({ method: 'gte', args: ['payment_date', '2026-06-01'] })
    expect(mock.calls).toContainEqual({ method: 'lte', args: ['payment_date', '2026-06-30'] })
    expect(mock.calls).toContainEqual({ method: 'order', args: ['payment_date'] })
  })

  it('drops payments attached to voided or soft-deleted invoices', async () => {
    mock.rows = [
      payment(),
      payment({
        invoice_id: 'inv-voided',
        invoices: {
          invoice_number: 'INV-VOID',
          invoice_date: '2026-06-01',
          voided_at: '2026-06-03T00:00:00Z',
          deleted_at: null,
          customers: { clinic_name: 'Void Clinic' },
        },
      }),
      payment({
        invoice_id: 'inv-deleted',
        invoices: {
          invoice_number: 'INV-DEL',
          invoice_date: '2026-06-01',
          voided_at: null,
          deleted_at: '2026-06-04T00:00:00Z',
          customers: { clinic_name: 'Deleted Clinic' },
        },
      }),
      payment({ invoice_id: null, invoices: null, reference_number: null }),
    ]

    const payments = await getReportPayments('2026-06-01', '2026-06-30')

    expect(payments.map((p) => p.invoice_id)).toEqual(['inv-visible', null])
    expect(payments[0]).toMatchObject({
      amount: 160,
      payment_date: '2026-06-02',
      reference_number: 'TRF-8841',
      invoice_id: 'inv-visible',
      invoice_number: 'INV-2026-0001',
      invoice_date: '2026-06-01',
      clinic_name: 'Origin Dental Clinic',
    })
    const select = mock.calls.find((call) => call.method === 'select')?.args[0]
    expect(select).toEqual(expect.stringContaining('voided_at'))
    expect(select).toEqual(expect.stringContaining('deleted_at'))
  })
})
