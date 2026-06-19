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
  'id' | 'invoice_number' | 'status' | 'total' | 'voided_at' | 'due_date' | 'invoice_date'
> & {
  customers?: { clinic_name: string } | null
  invoice_items?: ReportInvoiceItem[]
}

export type AgingInvoice = ReportInvoice & { daysOverdue: number }
export type CustomerAgg = { name: string; total: number; count: number }
export type ProductAgg = { name: string; total: number; qty: number }

export type ReportSummary = {
  totalInvoiced: number
  totalPaidInvoices: number
  totalOutstanding: number
  invoiceCount: number
  outstanding: AgingInvoice[]
  paid: ReportInvoice[]
  byCustomer: CustomerAgg[]
  byProduct: ProductAgg[]
}

const DAY_MS = 86_400_000

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

  const paid = active
    .filter((i) => i.status === 'paid')
    .sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1))

  const byCustomer = Object.values(
    active.reduce<Record<string, CustomerAgg>>((acc, inv) => {
      const name = inv.customers?.clinic_name ?? 'Unknown'
      if (!acc[name]) acc[name] = { name, total: 0, count: 0 }
      acc[name].total += Number(inv.total)
      acc[name].count += 1
      return acc
    }, {}),
  ).sort((a, b) => b.total - a.total).slice(0, 10)

  const byProductMap: Record<string, ProductAgg> = {}
  active.forEach((inv) => {
    ;(inv.invoice_items ?? []).forEach((item) => {
      const name = item.products?.name ?? item.description
      if (!byProductMap[name]) byProductMap[name] = { name, total: 0, qty: 0 }
      byProductMap[name].total += Number(item.amount)
      byProductMap[name].qty += Number(item.quantity)
    })
  })
  const byProduct = Object.values(byProductMap).sort((a, b) => b.total - a.total).slice(0, 10)

  return {
    totalInvoiced,
    totalPaidInvoices,
    totalOutstanding,
    invoiceCount: invoices.length,
    outstanding,
    paid,
    byCustomer,
    byProduct,
  }
}
