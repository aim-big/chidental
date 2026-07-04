// Print-only rendering of the Sales Reports page — one A4-friendly document
// covering every tab's data for the selected range, so the owner can hand a
// PDF/paper copy to the accountant instead of stitching CSVs together.
//
// Hidden on screen (`hidden`) and revealed only under @media print via
// `print:block`. Reuses the app-wide print CSS: everything outside
// `#invoice-print` is hidden when printing (see globals.css), which is why the
// wrapper carries that id — same mechanism as the invoice and statement pages.

import { COMPANY } from '@/lib/config'
import { formatCurrency, formatDate } from '@/lib/utils'
import { paymentStatusLabel } from '@/lib/status-badge'
import type { ReportSummary, ReportPayment, ClinicPaymentSpeed } from '@/lib/reports'

const th = 'border-b border-gray-400 py-1 text-left text-[11px] font-semibold uppercase tracking-wide'
const thRight = `${th} text-right`
const td = 'border-b border-gray-200 py-1 pr-3 text-xs'
const tdRight = `${td} pr-0 text-right tabular-nums`
const totalRow = 'border-t border-gray-500 py-1 pr-3 text-xs font-semibold'
const totalRight = `${totalRow} pr-0 text-right tabular-nums`

export function ReportPrintDocument({
  from, to, generatedOn, summary, payments, cashReceived, speedByClinic,
}: {
  from: string
  to: string
  generatedOn: string
  summary: ReportSummary
  payments: ReportPayment[]
  cashReceived: number
  speedByClinic: Record<string, ClinicPaymentSpeed>
}) {
  const { totalInvoiced, totalOutstanding, invoiceCount, outstanding, agingBuckets, byProduct, salesSummary } = summary

  return (
    <div id="invoice-print" className="hidden bg-white text-black print:block">
      {/* Title block */}
      <div className="mb-4 border-b-2 border-gray-800 pb-3">
        <h1 className="text-xl font-bold">{COMPANY.name}</h1>
        <p className="text-xs text-gray-600">{COMPANY.address}</p>
        <div className="mt-2 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Sales Report</h2>
          <p className="text-xs text-gray-600">
            {formatDate(from)} – {formatDate(to)} · Generated {formatDate(generatedOn)}
          </p>
        </div>
      </div>

      {/* Summary */}
      <section className="mb-4 break-inside-avoid">
        <table className="w-full">
          <tbody>
            <tr>
              <SummaryCell label={`Total Invoiced (${invoiceCount} invoices · by invoice date)`} value={formatCurrency(totalInvoiced)} />
              <SummaryCell label={`Collected (${payments.length} payments · by payment date)`} value={formatCurrency(cashReceived)} />
              <SummaryCell label={`Outstanding (${outstanding.length} unpaid · by invoice date)`} value={formatCurrency(totalOutstanding)} />
            </tr>
          </tbody>
        </table>
      </section>

      {/* A/R aging */}
      {outstanding.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h3 className="mb-1 text-sm font-semibold">A/R Aging</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Not due yet</th>
                <th className={thRight}>1–30 days</th>
                <th className={thRight}>31–60 days</th>
                <th className={thRight}>61–90 days</th>
                <th className={thRight}>Over 90 days</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${td} tabular-nums`}>{formatCurrency(agingBuckets.current)}</td>
                <td className={tdRight}>{formatCurrency(agingBuckets.d1_30)}</td>
                <td className={tdRight}>{formatCurrency(agingBuckets.d31_60)}</td>
                <td className={tdRight}>{formatCurrency(agingBuckets.d61_90)}</td>
                <td className={tdRight}>{formatCurrency(agingBuckets.d90plus)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Outstanding invoices */}
      {outstanding.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h3 className="mb-1 text-sm font-semibold">Outstanding Invoices</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Invoice #</th>
                <th className={th}>Clinic</th>
                <th className={th}>Due Date</th>
                <th className={th}>Aging</th>
                <th className={th}>Status</th>
                <th className={thRight}>Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {outstanding.map(inv => (
                <tr key={inv.id}>
                  <td className={td}>{inv.invoice_number}</td>
                  <td className={td}>{inv.customers?.clinic_name}</td>
                  <td className={td}>{formatDate(inv.due_date)}</td>
                  <td className={td}>{inv.daysOverdue > 0 ? `${inv.daysOverdue}d overdue` : 'Not due yet'}</td>
                  <td className={td}>{paymentStatusLabel(inv.status)}</td>
                  <td className={tdRight}>{formatCurrency(inv.balanceDue)}</td>
                </tr>
              ))}
              <tr>
                <td className={totalRow} colSpan={5}>Total</td>
                <td className={totalRight}>{formatCurrency(totalOutstanding)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* By clinic */}
      {salesSummary.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h3 className="mb-1 text-sm font-semibold">Sales by Clinic</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Clinic</th>
                <th className={thRight}>Invoices</th>
                <th className={thRight}>Total Sales</th>
                <th className={thRight}>Paid</th>
                <th className={thRight}>Outstanding</th>
                <th className={thRight}>Draft</th>
                <th className={thRight}>Avg Days to Pay</th>
              </tr>
            </thead>
            <tbody>
              {salesSummary.map(c => (
                <tr key={c.name}>
                  <td className={td}>{c.name}</td>
                  <td className={tdRight}>{c.count}</td>
                  <td className={tdRight}>{formatCurrency(c.total)}</td>
                  <td className={tdRight}>{formatCurrency(c.paid)}</td>
                  <td className={tdRight}>{formatCurrency(c.outstanding)}</td>
                  <td className={tdRight}>{formatCurrency(c.draft)}</td>
                  <td className={tdRight}>{speedByClinic[c.name] ? `${speedByClinic[c.name].avgDaysToPay}d` : '—'}</td>
                </tr>
              ))}
              <tr>
                <td className={totalRow}>Total</td>
                <td className={totalRight}>{salesSummary.reduce((s, c) => s + c.count, 0)}</td>
                <td className={totalRight}>{formatCurrency(salesSummary.reduce((s, c) => s + c.total, 0))}</td>
                <td className={totalRight}>{formatCurrency(salesSummary.reduce((s, c) => s + c.paid, 0))}</td>
                <td className={totalRight}>{formatCurrency(salesSummary.reduce((s, c) => s + c.outstanding, 0))}</td>
                <td className={totalRight}>{formatCurrency(salesSummary.reduce((s, c) => s + c.draft, 0))}</td>
                <td className={totalRight} />
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* By product */}
      {byProduct.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h3 className="mb-1 text-sm font-semibold">Sales by Product</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Product</th>
                <th className={thRight}>Quantity</th>
                <th className={thRight}>Total</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.map(p => (
                <tr key={p.name}>
                  <td className={td}>{p.name}</td>
                  <td className={tdRight}>{p.qty}</td>
                  <td className={tdRight}>{formatCurrency(p.total)}</td>
                </tr>
              ))}
              <tr>
                <td className={totalRow}>Total</td>
                <td className={totalRight}>{byProduct.reduce((s, p) => s + p.qty, 0)}</td>
                <td className={totalRight}>{formatCurrency(byProduct.reduce((s, p) => s + p.total, 0))}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {/* Payments received */}
      {payments.length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h3 className="mb-1 text-sm font-semibold">Payments Received</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Invoice #</th>
                <th className={th}>Clinic</th>
                <th className={th}>Reference</th>
                <th className={thRight}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i}>
                  <td className={td}>{formatDate(p.payment_date)}</td>
                  <td className={td}>{p.invoice_number}</td>
                  <td className={td}>{p.clinic_name}</td>
                  <td className={td}>{p.reference_number}</td>
                  <td className={tdRight}>{formatCurrency(p.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className={totalRow} colSpan={4}>Total</td>
                <td className={totalRight}>{formatCurrency(cashReceived)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <td className="border border-gray-300 p-2 align-top">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </td>
  )
}
