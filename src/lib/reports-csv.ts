// Builds the Sales Reports page as a single downloadable CSV. Kept as a pure
// function (no DOM/Blob) so it can be unit-tested; the client island handles the
// actual file download. Money is emitted as raw numbers and dates as the ISO
// `yyyy-MM-dd` strings the DB already stores, so the file is spreadsheet-ready.

import type { ReportSummary } from './reports'
import { paymentStatusLabel } from './status-badge'

// RFC 4180 field escaping: wrap in quotes when the value contains a comma,
// quote, or newline, doubling any embedded quotes.
function csvField(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function row(fields: Array<string | number>): string {
  return fields.map(csvField).join(',')
}

export function reportCsvFilename(range: { from: string; to: string }): string {
  return `sales-report_${range.from}_${range.to}.csv`
}

/**
 * The whole report for the selected range as one CSV: header + summary, the full
 * Outstanding and Paid invoice lists, and the By Clinic / By Product breakdowns
 * (top 10, matching the on-screen charts). Sections are separated by blank lines
 * and rows are CRLF-joined for Excel.
 */
export function buildReportCsv(summary: ReportSummary, range: { from: string; to: string }): string {
  const { totalInvoiced, totalPaidInvoices, totalOutstanding, invoiceCount, outstanding, paid, byCustomer, byProduct } =
    summary
  const lines: string[] = []

  lines.push(row(['Sales Report']))
  lines.push(row(['Range', range.from, range.to]))
  lines.push('')

  lines.push(row(['Summary']))
  lines.push(row(['Total Invoiced', totalInvoiced]))
  lines.push(row(['Collected (Paid)', totalPaidInvoices]))
  lines.push(row(['Outstanding', totalOutstanding]))
  lines.push(row(['Invoices', invoiceCount]))
  lines.push('')

  lines.push(row(['Outstanding Invoices']))
  lines.push(row(['Invoice #', 'Clinic', 'Due Date', 'Days Overdue', 'Amount', 'Status']))
  for (const inv of outstanding) {
    lines.push(
      row([
        inv.invoice_number,
        inv.customers?.clinic_name ?? '',
        inv.due_date,
        inv.daysOverdue,
        Number(inv.total),
        paymentStatusLabel(inv.status),
      ]),
    )
  }
  lines.push('')

  lines.push(row(['Paid Invoices']))
  lines.push(row(['Invoice #', 'Clinic', 'Invoice Date', 'Amount', 'Status']))
  for (const inv of paid) {
    lines.push(
      row([
        inv.invoice_number,
        inv.customers?.clinic_name ?? '',
        inv.invoice_date,
        Number(inv.total),
        paymentStatusLabel(inv.status),
      ]),
    )
  }
  lines.push('')

  lines.push(row(['Revenue by Clinic (Top 10)']))
  lines.push(row(['Clinic', 'Invoices', 'Total']))
  for (const c of byCustomer) {
    lines.push(row([c.name, c.count, c.total]))
  }
  lines.push('')

  lines.push(row(['Revenue by Product (Top 10)']))
  lines.push(row(['Product', 'Quantity', 'Total']))
  for (const p of byProduct) {
    lines.push(row([p.name, p.qty, p.total]))
  }

  return lines.join('\r\n')
}
