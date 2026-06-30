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
  byCustomer: [{ name: 'Origin Dental Clinic', total: 4500, count: 2 }],
  byProduct: [{ name: 'Zirconia Crown', total: 3000, qty: 5 }],
}

const range = { from: '2026-06-01', to: '2026-06-30' }

describe('buildReportCsv', () => {
  it('emits every section with its header row', () => {
    const csv = buildReportCsv(summary, range)
    expect(csv).toContain('Sales Report')
    expect(csv).toContain('Range,2026-06-01,2026-06-30')
    expect(csv).toContain('Summary')
    expect(csv).toContain('Total Invoiced,15180')
    expect(csv).toContain('Outstanding Invoices')
    expect(csv).toContain('Paid Invoices')
    expect(csv).toContain('Revenue by Clinic (Top 10)')
    expect(csv).toContain('Revenue by Product (Top 10)')
  })

  it('writes raw numeric amounts and ISO dates, not formatted strings', () => {
    const csv = buildReportCsv(summary, range)
    // Outstanding row: number,clinic,due,daysOverdue,amount,status
    expect(csv).toContain('INV-2026-0015,Dr Ray & Partners Dental Clinic,2026-07-08,-8,1800,Issued')
    // Paid row uses the invoice date and the friendly "Paid" label
    expect(csv).toContain('INV-2026-0001,Origin Dental Clinic,2026-06-02,160,Paid')
    expect(csv).not.toContain('RM')
  })

  it('uses the friendly payment-status label (sent -> Issued)', () => {
    const csv = buildReportCsv(summary, range)
    expect(csv).toContain(',Issued')
    expect(csv).not.toContain(',sent')
  })

  it('quotes fields that contain commas or quotes', () => {
    const csv = buildReportCsv(
      { ...summary, byProduct: [{ name: 'Crown, "Premium"', total: 10, qty: 1 }] },
      range,
    )
    expect(csv).toContain('"Crown, ""Premium""",1,10')
  })

  it('aggregation rows carry count/qty and total', () => {
    const csv = buildReportCsv(summary, range)
    expect(csv).toContain('Origin Dental Clinic,2,4500')
    expect(csv).toContain('Zirconia Crown,5,3000')
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
    const csv = buildReportCsv(empty, range)
    expect(csv).toContain('Total Invoiced,0')
    expect(csv).toContain('Outstanding Invoices')
  })

  it('uses CRLF line endings', () => {
    expect(buildReportCsv(summary, range)).toContain('\r\n')
  })
})

describe('reportCsvFilename', () => {
  it('includes the date range', () => {
    expect(reportCsvFilename(range)).toBe('sales-report_2026-06-01_2026-06-30.csv')
  })
})
