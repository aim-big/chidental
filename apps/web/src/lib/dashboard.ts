// Pure aggregation for the Dashboard. Kept out of the component so it can be
// unit-tested and so the page stays a thin Server Component. Reuses the reports
// helpers (`aggregateByProduct`/`aggregateByCustomer`) where the two overlap,
// and adds the dashboard-only numbers: real cash collected (from the payments
// table), monthly sales-vs-payment trend, and period-over-period growth.

import { differenceInCalendarDays, eachMonthOfInterval, format } from 'date-fns'
import { isVoided, isOutstanding, isOverdue, balanceDue } from '@chidental/shared'
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
// `invoice_date` (the paid invoice's issue date) feeds avg-days-to-collect.
export type DashboardPayment = { amount: number; payment_date: string; invoice_date?: string | null }

// Prior-period invoice, narrowed to the growth inputs.
export type DashboardPriorInvoice = {
  total: number
  customer_id: string | null
  voided_at: string | null
}

// Outstanding KPI is an all-time point-in-time snapshot (money owed right now),
// NOT scoped to the selected range — the invoices most worth chasing are the old
// unpaid ones. Narrowed to what `isOutstanding`/`isOverdue` read.
export type DashboardOutstandingInvoice = {
  total: number
  amount_paid?: number | null
  status: string
  voided_at: string | null
  due_date: string | null
}

// One undelivered work-queue line item (parent invoice not voided/deleted).
export type DashboardWorkItem = { work_status: string }

// Jobs currently on the floor, by top-level work status (delivered excluded).
export type WorkInProgress = {
  received: number
  inProgress: number
  ready: number
  onHold: number
  total: number
}

export type TrendPoint = { month: string; label: string; sales: number; payments: number }

export type DashboardSummary = {
  sales: number
  paymentsReceived: number
  outstanding: number
  /** Count and value of outstanding invoices already past their due date. */
  overdueCount: number
  overdueAmount: number
  invoiceCount: number
  /** (sales − priorSales) / priorSales; null when there is no prior baseline. */
  salesGrowthPct: number | null
  /** Same-window-last-year growth; null when last year has no sales. */
  salesYoYPct: number | null
  /** paymentsReceived ÷ sales for the range; null when nothing was billed. */
  collectionRate: number | null
  /** Mean days from invoice date to payment date (whole days); null when no payments carry an invoice date. */
  avgDaysToCollect: number | null
  avgInvoiceValue: number
  avgInvoiceValuePrior: number
  newClinics: number
  returningClinics: number
  wip: WorkInProgress
  trend: TrendPoint[]
  byProduct: ProductAgg[]
  byCustomer: CustomerAgg[]
}

const monthKey = (isoDate: string) => isoDate.slice(0, 7) // 'yyyy-MM'

export type DashboardInput = {
  invoices: DashboardInvoice[]
  payments: DashboardPayment[]
  priorInvoices: DashboardPriorInvoice[]
  lastYearInvoices: DashboardPriorInvoice[]
  outstandingInvoices: DashboardOutstandingInvoice[]
  workItems: DashboardWorkItem[]
  from: string // yyyy-MM-dd
  to: string // yyyy-MM-dd
  today: string // local yyyy-MM-dd — reference day for the overdue split
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
  lastYearInvoices,
  outstandingInvoices,
  workItems,
  from,
  to,
  today,
}: DashboardInput): DashboardSummary {
  const active = invoices.filter((i) => !isVoided(i))

  const sales = active.reduce((s, i) => s + Number(i.total), 0)
  const paymentsReceived = payments.reduce((s, p) => s + Number(p.amount), 0)
  // Money actually still owed: remaining balances, netting out partial payments.
  const outstanding = outstandingInvoices.filter((i) => isOutstanding(i)).reduce((s, i) => s + balanceDue(i), 0)
  const invoiceCount = active.length // voided invoices don't count anywhere on the dashboard

  // The chase-first slice of outstanding: already past the due date.
  const overdueList = outstandingInvoices.filter((i) => isOverdue(i, today))
  const overdueCount = overdueList.length
  const overdueAmount = overdueList.reduce((s, i) => s + balanceDue(i), 0)

  // Growth vs the prior period, and vs the same window last year.
  const priorActive = priorInvoices.filter((i) => !isVoided(i))
  const priorSales = priorActive.reduce((s, i) => s + Number(i.total), 0)
  const salesGrowthPct = priorSales > 0 ? (sales - priorSales) / priorSales : null
  const lastYearSales = lastYearInvoices.filter((i) => !isVoided(i)).reduce((s, i) => s + Number(i.total), 0)
  const salesYoYPct = lastYearSales > 0 ? (sales - lastYearSales) / lastYearSales : null

  // Cash-flow health: how much of what was billed this period came in as cash,
  // and how long a ringgit takes to arrive. Collection can exceed 100% when
  // old invoices are being settled — that's signal, not a bug.
  const collectionRate = sales > 0 ? paymentsReceived / sales : null
  const collectSamples = payments
    .filter((p) => p.invoice_date)
    .map((p) => Math.max(0, differenceInCalendarDays(new Date(p.payment_date), new Date(p.invoice_date as string))))
  const avgDaysToCollect = collectSamples.length > 0
    ? Math.round(collectSamples.reduce((s, d) => s + d, 0) / collectSamples.length)
    : null

  const avgInvoiceValue = active.length > 0 ? sales / active.length : 0
  const avgInvoiceValuePrior = priorActive.length > 0 ? priorSales / priorActive.length : 0

  // Jobs on the floor right now (undelivered items; parent voided/deleted
  // invoices are already excluded by the query).
  const wip: WorkInProgress = { received: 0, inProgress: 0, ready: 0, onHold: 0, total: 0 }
  for (const item of workItems) {
    if (item.work_status === 'received') wip.received++
    else if (item.work_status === 'in_progress') wip.inProgress++
    else if (item.work_status === 'ready') wip.ready++
    else if (item.work_status === 'on_hold') wip.onHold++
    else continue // delivered (or unknown) — not WIP
    wip.total++
  }

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
    overdueCount,
    overdueAmount,
    invoiceCount,
    salesGrowthPct,
    salesYoYPct,
    collectionRate,
    avgDaysToCollect,
    avgInvoiceValue,
    avgInvoiceValuePrior,
    newClinics,
    returningClinics,
    wip,
    trend,
    byProduct: aggregateByProduct(active),
    byCustomer: aggregateByCustomer(active),
  }
}
