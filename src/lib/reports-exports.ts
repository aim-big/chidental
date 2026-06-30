// Pure CSV builders for the three focused Sales Reports exports. No DOM/Blob so
// they stay unit-testable; the client island handles the download. Money is
// 2-dp plain numbers, dates ISO, RFC-4180 quoting, CRLF endings.

import type { ReportInvoice, ReportPayment, ProductAgg } from './reports'
import { paymentStatusLabel } from './status-badge'
import { COMPANY } from './config'

type Range = { from: string; to: string }

function csvField(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function row(fields: Array<string | number>): string {
  return fields.map(csvField).join(',')
}

const money = (n: number): string => Number(n).toFixed(2)

function titleBlock(reportName: string, range: Range, generatedOn: string): string[] {
  return [
    row([COMPANY.name]),
    row([reportName]),
    row(['Range', `${range.from} to ${range.to}`]),
    row(['Generated', generatedOn]),
    '',
  ]
}

export function salesReportFilename(range: Range): string {
  return `sales-report_${range.from}_${range.to}.csv`
}
export function paymentReportFilename(range: Range): string {
  return `payment-report_${range.from}_${range.to}.csv`
}
export function itemSalesReportFilename(range: Range): string {
  return `item-sales-report_${range.from}_${range.to}.csv`
}

// 1. Sales Report — invoices issued in the period (Tax = total − subtotal).
export function buildSalesReportCsv(sales: ReportInvoice[], range: Range, generatedOn: string): string {
  const lines = titleBlock('Sales Report', range, generatedOn)
  lines.push(row(['Date', 'Invoice #', 'Clinic', 'Subtotal', 'Tax', 'Total', 'Status']))
  let sub = 0
  let tax = 0
  let tot = 0
  for (const inv of sales) {
    const s = Number(inv.subtotal)
    const t = Number(inv.total)
    sub += s
    tax += t - s
    tot += t
    lines.push(
      row([
        inv.invoice_date,
        inv.invoice_number,
        inv.customers?.clinic_name ?? '',
        money(s),
        money(t - s),
        money(t),
        paymentStatusLabel(inv.status),
      ]),
    )
  }
  lines.push(row(['Total', '', '', money(sub), money(tax), money(tot), '']))
  return lines.join('\r\n')
}

// 2. Payment Report — money collected in the period.
export function buildPaymentReportCsv(payments: ReportPayment[], range: Range, generatedOn: string): string {
  const lines = titleBlock('Payment Report', range, generatedOn)
  lines.push(row(['Payment Date', 'Invoice #', 'Clinic', 'Amount', 'Reference']))
  let total = 0
  for (const p of payments) {
    total += Number(p.amount)
    lines.push(
      row([
        p.payment_date,
        p.invoice_number ?? '',
        p.clinic_name ?? '',
        money(Number(p.amount)),
        p.reference_number ?? '',
      ]),
    )
  }
  lines.push(row(['Total', '', '', money(total), '']))
  return lines.join('\r\n')
}

// 3. Item Sales Report — products/work sold in the period, with % share.
export function buildItemSalesReportCsv(byProduct: ProductAgg[], range: Range, generatedOn: string): string {
  const lines = titleBlock('Item Sales Report', range, generatedOn)
  lines.push(row(['Product', 'Qty', 'Total', '% of Sales']))
  const grand = byProduct.reduce((s, p) => s + Number(p.total), 0)
  const pct = (n: number): string => (grand > 0 ? `${((n / grand) * 100).toFixed(1)}%` : '0%')
  let qty = 0
  for (const p of byProduct) {
    qty += Number(p.qty)
    lines.push(row([p.name, p.qty, money(Number(p.total)), pct(Number(p.total))]))
  }
  lines.push(row(['Total', qty, money(grand), grand > 0 ? '100%' : '0%']))
  return lines.join('\r\n')
}
