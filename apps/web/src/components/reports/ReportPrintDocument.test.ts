import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { summarizeReports, type ReportInvoice } from '@/lib/reports'
import { ReportPrintDocument } from './ReportPrintDocument'

const invoice = (over: Partial<ReportInvoice> = {}): ReportInvoice => ({
  id: 'i1',
  invoice_number: 'INV-2026-0001',
  status: 'paid',
  total: 100,
  subtotal: 100,
  amount_paid: 100,
  voided_at: null,
  invoice_date: '2026-06-01',
  due_date: '2026-06-30',
  customers: { clinic_name: 'Origin Dental Clinic' },
  invoice_items: [{ description: 'Crown', amount: 100, quantity: 1 }],
  ...over,
})

describe('ReportPrintDocument', () => {
  it('prints the all-invoices detail behind Total Invoiced', () => {
    const summary = summarizeReports([invoice()], new Date('2026-07-01T00:00:00Z').getTime())
    const html = renderToStaticMarkup(
      createElement(ReportPrintDocument, {
        from: '2026-06-01',
        to: '2026-06-30',
        generatedOn: '2026-07-01',
        summary,
        payments: [],
        cashReceived: 0,
        speedByClinic: {},
      }),
    )

    expect(html).toContain('All Invoices')
    expect(html).toContain('INV-2026-0001')
    expect(html).toContain('Origin Dental Clinic')
  })
})
