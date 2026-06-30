import { describe, it, expect } from 'vitest'
import {
  buildSalesReportCsv,
  buildPaymentReportCsv,
  buildItemSalesReportCsv,
  salesReportFilename,
  paymentReportFilename,
  itemSalesReportFilename,
} from './reports-exports'
import type { ReportInvoice, ReportPayment, ProductAgg } from './reports'

const range = { from: '2026-06-01', to: '2026-06-30' }
const GEN = '2026-06-30'

const sale = (over: Partial<ReportInvoice> = {}): ReportInvoice => ({
  id: 'i1',
  invoice_number: 'INV-2026-0015',
  status: 'sent',
  total: 1800,
  subtotal: 1800,
  voided_at: null,
  invoice_date: '2026-06-08',
  due_date: '2026-07-08',
  customers: { clinic_name: 'Dr Ray & Partners Dental Clinic' },
  ...over,
})

describe('buildSalesReportCsv', () => {
  it('writes title block, columns, a row, and a Total', () => {
    const csv = buildSalesReportCsv([sale()], range, GEN)
    expect(csv).toContain('Chi Dental Lab')
    expect(csv).toContain('Sales Report')
    expect(csv).toContain('Range,2026-06-01 to 2026-06-30')
    expect(csv).toContain('Generated,2026-06-30')
    expect(csv).toContain('Date,Invoice #,Clinic,Subtotal,Tax,Total,Status')
    expect(csv).toContain('2026-06-08,INV-2026-0015,Dr Ray & Partners Dental Clinic,1800.00,0.00,1800.00,Issued')
    expect(csv).toContain('Total,,,1800.00,0.00,1800.00,')
    expect(csv).not.toContain('RM')
  })

  it('computes Tax as total minus subtotal', () => {
    const csv = buildSalesReportCsv([sale({ subtotal: 1000, total: 1060 })], range, GEN)
    expect(csv).toContain(',1000.00,60.00,1060.00,Issued')
  })

  it('uses CRLF and handles empty input', () => {
    const csv = buildSalesReportCsv([], range, GEN)
    expect(csv).toContain('\r\n')
    expect(csv).toContain('Total,,,0.00,0.00,0.00,')
  })
})

const pay = (over: Partial<ReportPayment> = {}): ReportPayment => ({
  amount: 160,
  payment_date: '2026-06-02',
  reference_number: 'TRF-8841',
  invoice_number: 'INV-2026-0001',
  clinic_name: 'Origin Dental Clinic',
  ...over,
})

describe('buildPaymentReportCsv', () => {
  it('writes columns, a row, and a Total', () => {
    const csv = buildPaymentReportCsv([pay()], range, GEN)
    expect(csv).toContain('Payment Report')
    expect(csv).toContain('Payment Date,Invoice #,Clinic,Amount,Reference')
    expect(csv).toContain('2026-06-02,INV-2026-0001,Origin Dental Clinic,160.00,TRF-8841')
    expect(csv).toContain('Total,,,160.00,')
  })

  it('blanks a null reference and tolerates null invoice/clinic', () => {
    const csv = buildPaymentReportCsv(
      [pay({ reference_number: null, invoice_number: null, clinic_name: null })],
      range,
      GEN,
    )
    expect(csv).toContain('2026-06-02,,,160.00,')
  })
})

const prod = (over: Partial<ProductAgg> = {}): ProductAgg => ({ name: 'Zirconia Crown', total: 3000, qty: 5, ...over })

describe('buildItemSalesReportCsv', () => {
  it('writes columns, rows with % of sales, and a 100% Total', () => {
    const csv = buildItemSalesReportCsv([prod(), prod({ name: 'Bridge', total: 1000, qty: 2 })], range, GEN)
    expect(csv).toContain('Item Sales Report')
    expect(csv).toContain('Product,Qty,Total,% of Sales')
    expect(csv).toContain('Zirconia Crown,5,3000.00,75.0%')
    expect(csv).toContain('Bridge,2,1000.00,25.0%')
    expect(csv).toContain('Total,7,4000.00,100%')
  })

  it('renders 0% share when totals are zero, and quotes commas', () => {
    const csv = buildItemSalesReportCsv([prod({ name: 'A, B', total: 0, qty: 0 })], range, GEN)
    expect(csv).toContain('"A, B",0,0.00,0%')
    expect(csv).toContain('Total,0,0.00,0%')
  })
})

describe('filenames', () => {
  it('include the range', () => {
    expect(salesReportFilename(range)).toBe('sales-report_2026-06-01_2026-06-30.csv')
    expect(paymentReportFilename(range)).toBe('payment-report_2026-06-01_2026-06-30.csv')
    expect(itemSalesReportFilename(range)).toBe('item-sales-report_2026-06-01_2026-06-30.csv')
  })
})
