// Pure aggregation for the Sales Reports page. Kept out of the component so it
// can be unit-tested and so the page stays a thin Server Component. Mirrors the
// in-render math the old client page did.

import type { Invoice } from '@/lib/database.types'
import { countsAsRevenue, isOutstanding, isVoided } from '@/lib/invoice-status'

export type ReportInvoiceItem = {
  description: string
  amount: number
  quantity: number
  products?: { name: string } | null
}

// `Invoice` is relation-augmented (carries full `customers`/`invoice_items`),
// so we Pick only the scalar fields the reports use and attach the narrowed
// projections the query actually selects.
export type ReportInvoice = Pick<
  Invoice,
  'id' | 'invoice_number' | 'status' | 'total' | 'subtotal' | 'voided_at' | 'due_date' | 'invoice_date'
> & {
  customers?: { clinic_name: string } | null
  invoice_items?: ReportInvoiceItem[]
}

export type AgingInvoice = ReportInvoice & { daysOverdue: number }
export type CustomerAgg = { name: string; total: number; count: number }
export type ProductAgg = { name: string; total: number; qty: number }
export type SalesSummaryRow = {
  name: string
  count: number
  total: number
  paid: number
  outstanding: number
  draft: number
}
export type ReportPayment = {
  amount: number
  payment_date: string
  reference_number: string | null
  invoice_number: string | null
  /** Issue date of the paid invoice — feeds days-to-pay. Null if the join is missing. */
  invoice_date: string | null
  clinic_name: string | null
}

export type ClinicPaymentSpeed = { payments: number; avgDaysToPay: number }

/**
 * How fast each clinic pays, from the payments received in the range: mean
 * whole days between the invoice's issue date and the payment date, keyed by
 * clinic name (same key as `salesSummary`). Payments without an invoice join
 * are skipped; a same-day payment counts as 0 days.
 */
export function avgDaysToPayByClinic(payments: ReportPayment[]): Record<string, ClinicPaymentSpeed> {
  const acc: Record<string, { days: number; payments: number }> = {}
  for (const p of payments) {
    if (!p.invoice_date || !p.clinic_name) continue
    const days = Math.max(
      0,
      Math.floor((new Date(p.payment_date).getTime() - new Date(p.invoice_date).getTime()) / DAY_MS),
    )
    if (!acc[p.clinic_name]) acc[p.clinic_name] = { days: 0, payments: 0 }
    acc[p.clinic_name].days += days
    acc[p.clinic_name].payments += 1
  }
  return Object.fromEntries(
    Object.entries(acc).map(([name, { days, payments: n }]) => [
      name,
      { payments: n, avgDaysToPay: Math.round(days / n) },
    ]),
  )
}

// Outstanding value bucketed by how far past due it is (money, not counts).
// "current" = not yet due. Buckets sum to `totalOutstanding`.
export type AgingBuckets = {
  current: number
  d1_30: number
  d31_60: number
  d61_90: number
  d90plus: number
}

export type ReportSummary = {
  totalInvoiced: number
  totalPaidInvoices: number
  totalOutstanding: number
  invoiceCount: number
  outstanding: AgingInvoice[]
  agingBuckets: AgingBuckets
  paid: ReportInvoice[]
  sales: ReportInvoice[]
  byProduct: ProductAgg[]
  salesSummary: SalesSummaryRow[]
}

const DAY_MS = 86_400_000

/**
 * Revenue grouped by clinic, descending, top 10 by default. Shared by the reports and
 * dashboard summaries. `invoices` should already exclude voided rows.
 */
export function aggregateByCustomer(invoices: ReportInvoice[], limit = 10): CustomerAgg[] {
  return Object.values(
    invoices.reduce<Record<string, CustomerAgg>>((acc, inv) => {
      const name = inv.customers?.clinic_name ?? 'Unknown'
      if (!acc[name]) acc[name] = { name, total: 0, count: 0 }
      acc[name].total += Number(inv.total)
      acc[name].count += 1
      return acc
    }, {}),
  ).sort((a, b) => b.total - a.total).slice(0, limit)
}

/**
 * Revenue grouped by product (falling back to the line description when a line
 * has no linked product), descending, top 10 by default. Shared by reports and dashboard.
 * `invoices` should already exclude voided rows.
 */
export function aggregateByProduct(invoices: ReportInvoice[], limit = 10): ProductAgg[] {
  const map: Record<string, ProductAgg> = {}
  invoices.forEach((inv) => {
    ;(inv.invoice_items ?? []).forEach((item) => {
      const name = item.products?.name ?? item.description
      if (!map[name]) map[name] = { name, total: 0, qty: 0 }
      map[name].total += Number(item.amount)
      map[name].qty += Number(item.quantity)
    })
  })
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, limit)
}

/**
 * Total sales per clinic, partitioned by payment status, for the Sales Summary
 * report. `total` is every non-voided invoice's full value; `paid`/`outstanding`
 * are the value of paid vs issued-but-unpaid (sent/partial/overdue) invoices, and
 * `draft` is the remainder so `paid + outstanding + draft === total` always holds
 * (that leftover is the value of un-issued drafts). These are invoice values by
 * status — NOT cash collected; real collections are the Payment Report. Sorted by
 * total descending, all clinics.
 */
export function aggregateSalesSummary(invoices: ReportInvoice[]): SalesSummaryRow[] {
  const map: Record<string, SalesSummaryRow> = {}
  for (const inv of invoices) {
    if (isVoided(inv)) continue
    const name = inv.customers?.clinic_name ?? 'Unknown'
    if (!map[name]) map[name] = { name, count: 0, total: 0, paid: 0, outstanding: 0, draft: 0 }
    const agg = map[name]
    const t = Number(inv.total)
    agg.count += 1
    agg.total += t
    if (countsAsRevenue(inv)) agg.paid += t
    else if (isOutstanding(inv)) agg.outstanding += t
  }
  return Object.values(map)
    .map((r) => ({ ...r, draft: r.total - r.paid - r.outstanding }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Summarize a date-ranged set of invoices for the reports page. `nowMs` is the
 * reference time for aging (pass `Date.now()` at the call site so this stays
 * deterministic/testable). Voided invoices never count toward any total.
 */
export function summarizeReports(invoices: ReportInvoice[], nowMs: number): ReportSummary {
  const active = invoices.filter((i) => !isVoided(i))

  const totalInvoiced = active.reduce((s, i) => s + Number(i.total), 0)
  const totalPaidInvoices = invoices.filter((i) => countsAsRevenue(i)).reduce((s, i) => s + Number(i.total), 0)
  const totalOutstanding = invoices.filter((i) => isOutstanding(i)).reduce((s, i) => s + Number(i.total), 0)

  const outstanding: AgingInvoice[] = invoices
    .filter((i) => isOutstanding(i))
    .map((i) => ({ ...i, daysOverdue: Math.floor((nowMs - new Date(i.due_date).getTime()) / DAY_MS) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  // A/R aging: the outstanding value distributed by how overdue it is. Reuses
  // each row's daysOverdue so the buckets always agree with the table below them.
  const agingBuckets: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }
  for (const inv of outstanding) {
    const amt = Number(inv.total)
    if (inv.daysOverdue <= 0) agingBuckets.current += amt
    else if (inv.daysOverdue <= 30) agingBuckets.d1_30 += amt
    else if (inv.daysOverdue <= 60) agingBuckets.d31_60 += amt
    else if (inv.daysOverdue <= 90) agingBuckets.d61_90 += amt
    else agingBuckets.d90plus += amt
  }

  const paid = active
    .filter((i) => i.status === 'paid')
    .sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1))

  const sales = [...active].sort((a, b) => (a.invoice_date < b.invoice_date ? -1 : 1))

  const byProduct = aggregateByProduct(active, Infinity)
  // Per-clinic rows (count/total + paid/outstanding/draft) — supersedes the old
  // byCustomer aggregation on this page; the dashboard still uses aggregateByCustomer.
  const salesSummary = aggregateSalesSummary(active)

  return {
    totalInvoiced,
    totalPaidInvoices,
    totalOutstanding,
    invoiceCount: active.length, // voided invoices don't count as issued
    outstanding,
    agingBuckets,
    paid,
    sales,
    byProduct,
    salesSummary,
  }
}
