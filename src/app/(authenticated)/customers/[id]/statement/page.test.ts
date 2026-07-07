import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import StatementPage from './page'

const mocks = vi.hoisted(() => ({
  getClinicStatement: vi.fn(),
  getBillingSettings: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))

vi.mock('@/data/customers', () => ({
  getClinicStatement: mocks.getClinicStatement,
}))

vi.mock('@/data/billing-settings', () => ({
  getBillingSettings: mocks.getBillingSettings,
}))

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: mocks.requirePermission,
}))

describe('StatementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePermission.mockResolvedValue({ ok: true })
    mocks.getBillingSettings.mockResolvedValue({
      bankName: 'Test Bank',
      accountName: 'Chi Dental Lab',
      accountNumber: '123456789',
      paymentNote: null,
      paymentTermsDays: 30,
    })
  })

  it('renders one combined statement with period records and open invoice records', async () => {
    mocks.getClinicStatement.mockResolvedValue({
      clinic: {
        id: 'clinic-1',
        clinic_name: 'Bright Smile Clinic',
        contact_person: null,
        ssm_no: null,
        billing_address: null,
      },
      invoices: [
        {
          id: 'inv-period',
          invoice_number: 'INV-100',
          invoice_date: '2026-06-10',
          due_date: '2026-07-10',
          patient: 'Ali',
          total: 300,
          status: 'partial',
          voided_at: null,
        },
      ],
      payments: [
        {
          invoice_id: 'inv-period',
          amount: 120,
          payment_date: '2026-06-20',
          reference_number: 'PAY-1',
        },
      ],
      credits: [],
    })

    const html = renderToStaticMarkup(
      await StatementPage({
        params: Promise.resolve({ id: 'clinic-1' }),
        searchParams: Promise.resolve({ from: '2026-06-01', to: '2026-06-30' }),
      }),
    )

    expect(html).toContain('From date')
    expect(html).toContain('Invoice and payment records')
    expect(html).toContain('Payment received · Ref PAY-1')
    expect(html).toContain('Outstanding invoice records')
    expect(html).toContain('INV-100')
    expect(html).not.toContain('Full activity')
    expect(html).not.toContain('Outstanding only')
  })

  it('prints account totals even when no invoices are outstanding', async () => {
    mocks.getClinicStatement.mockResolvedValue({
      clinic: {
        id: 'clinic-1',
        clinic_name: 'Bright Smile Clinic',
        contact_person: null,
        ssm_no: null,
        billing_address: null,
      },
      invoices: [
        {
          id: 'inv-paid',
          invoice_number: 'INV-001',
          invoice_date: '2026-06-01',
          due_date: '2026-06-30',
          patient: 'Ali',
          total: 100,
          status: 'paid',
          voided_at: null,
        },
      ],
      payments: [
        {
          invoice_id: 'inv-paid',
          amount: 100,
          payment_date: '2026-06-05',
          reference_number: 'PAID',
        },
      ],
      credits: [],
    })

    const html = renderToStaticMarkup(
      await StatementPage({
        params: Promise.resolve({ id: 'clinic-1' }),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(html).toContain('No outstanding invoices.')
    expect(html).toContain('Total billed to date')
    expect(html).toContain('Total paid to date')
    expect(html).toContain('Balance Due')
  })

  it('prints aging when credits offset the net account balance but invoices remain open', async () => {
    mocks.getClinicStatement.mockResolvedValue({
      clinic: {
        id: 'clinic-1',
        clinic_name: 'Bright Smile Clinic',
        contact_person: null,
        ssm_no: null,
        billing_address: null,
      },
      invoices: [
        {
          id: 'inv-open',
          invoice_number: 'INV-002',
          invoice_date: '2026-06-01',
          due_date: '2026-06-30',
          patient: 'Ali',
          total: 200,
          status: 'sent',
          voided_at: null,
        },
      ],
      payments: [],
      credits: [
        {
          credit_date: '2026-06-15',
          amount: 250,
          reason: 'goodwill',
          invoice_id: null,
        },
      ],
    })

    const html = renderToStaticMarkup(
      await StatementPage({
        params: Promise.resolve({ id: 'clinic-1' }),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(html).toContain('Account Balance')
    expect(html).toContain('A/R Aging as at')
  })
})
