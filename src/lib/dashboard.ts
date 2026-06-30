// Pure aggregation for the Dashboard. Kept out of the component so it can be
// unit-tested and so the page stays a thin Server Component. Reuses the reports
// helpers (`aggregateByProduct`/`aggregateByCustomer`) where the two overlap,
// and adds the dashboard-only numbers: real cash collected (from the payments
// table), monthly sales-vs-payment trend, and period-over-period growth.

import { eachMonthOfInterval, format } from 'date-fns'
import { isVoided, isOutstanding } from '@/lib/invoice-status'
import {
  aggregateByCustomer,
  aggregateByProduct,
  type ReportInvoice,
  type CustomerAgg,
  type ProductAgg,
} from '@/lib/reports'

// Current-range invoice: the reports shape plus the clinic id (for new-vs-
// returning). The query selects `*`, so `customer_id` is present at runtime.
export type DashboardInvoice = ReportInvoice & { customer_id: string | null }

// One recorded payment row, narrowed to what the trend/KPI need.
export type DashboardPayment = { amount: number; payment_date: string }

// Prior-period invoice, narrowed to the growth inputs.
export type DashboardPriorInvoice = {
  total: number
  customer_id: string | null
  voided_at: string | null
}

// Outstanding KPI is an all-time point-in-time snapshot (money owed right now),
// NOT scoped to the selected range — the invoices most worth chasing are the old
// unpaid ones. Narrowed to what `isOutstanding` reads.
export type DashboardOutstandingInvoice = {
  total: number
  status: string
  voided_at: string | null
}

export type TrendPoint = { month: string; label: string; sales: number; payments: number }

export type DashboardSummary = {
  sales: number
  paymentsReceived: number
  outstanding: number
  invoiceCount: number
  /** (sales − priorSales) / priorSales; null when there is no prior baseline. */
  salesGrowthPct: number | null
  avgInvoiceValue: number
  avgInvoiceValuePrior: number
  newClinics: number
  returningClinics: number
  trend: TrendPoint[]
  byProduct: ProductAgg[]
  byCustomer: CustomerAgg[]
}

const monthKey = (isoDate: string) => isoDate.slice(0, 7) // 'yyyy-MM'

export type DashboardInput = {
  invoices: DashboardInvoice[]
  payments: DashboardPayment[]
  priorInvoices: DashboardPriorInvoice[]
  outstandingInvoices: DashboardOutstandingInvoice[]
  from: string // yyyy-MM-dd
  to: string // yyyy-MM-dd
}

/**
 * Summarize a date-ranged slice of the business for the dashboard. All money is
 * scoped to [from, to]: `sales` is invoices issued, `paymentsReceived` is cash
 * actually collected (payment rows). `outstanding` is an all-time snapshot of
 * money owed (from `outstandingInvoices`, NOT the range slice). Voided invoices
 * never count. Growth compares against the caller-supplied prior-period
 * invoices (same-length window before `from`).
 */
export function summarizeDashboard({
  invoices,
  payments,
  priorInvoices,
  outstandingInvoices,
  from,
  to,
}: DashboardInput): DashboardSummary {
  const active = invoices.filter((i) => !isVoided(i))

  const sales = active.reduce((s, i) => s + Number(i.total), 0)
  const paymentsReceived = payments.reduce((s, p) => s + Number(p.amount), 0)
  const outstanding = outstandingInvoices.filter((i) => isOutstanding(i)).reduce((s, i) => s + Number(i.total), 0)
  const invoiceCount = invoices.length

  // Growth vs the prior period.
  const priorActive = priorInvoices.filter((i) => !isVoided(i))
  const priorSales = priorActive.reduce((s, i) => s + Number(i.total), 0)
  const salesGrowthPct = priorSales > 0 ? (sales - priorSales) / priorSales : null

  const avgInvoiceValue = active.length > 0 ? sales / active.length : 0
  const avgInvoiceValuePrior = priorActive.length > 0 ? priorSales / priorActive.length : 0

  // New vs returning: a clinic billed in range is "returning" if it was also
  // billed in the prior period, else "new".
  const priorClinicIds = new Set(priorActive.map((i) => i.customer_id).filter(Boolean) as string[])
  const currentClinicIds = new Set(active.map((i) => i.customer_id).filter(Boolean) as string[])
  let newClinics = 0
  let returningClinics = 0
  for (const id of currentClinicIds) {
    if (priorClinicIds.has(id)) returningClinics++
    else newClinics++
  }

  // Monthly sales-vs-payment trend across the whole range (every month present,
  // even with zero activity, so the chart axis is continuous).
  const months = eachMonthOfInterval({ start: new Date(from), end: new Date(to) })
  const trendMap = new Map<string, TrendPoint>()
  for (const m of months) {
    const key = format(m, 'yyyy-MM')
    trendMap.set(key, { month: key, label: format(m, 'MMM'), sales: 0, payments: 0 })
  }
  for (const inv of active) {
    const pt = trendMap.get(monthKey(inv.invoice_date))
    if (pt) pt.sales += Number(inv.total)
  }
  for (const p of payments) {
    const pt = trendMap.get(monthKey(p.payment_date))
    if (pt) pt.payments += Number(p.amount)
  }
  const trend = Array.from(trendMap.values())

  return {
    sales,
    paymentsReceived,
    outstanding,
    invoiceCount,
    salesGrowthPct,
    avgInvoiceValue,
    avgInvoiceValuePrior,
    newClinics,
    returningClinics,
    trend,
    byProduct: aggregateByProduct(active),
    byCustomer: aggregateByCustomer(active),
  }
}
