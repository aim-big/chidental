// Server-side READ query for the dashboard.
//
// The dashboard module is served entirely by the NestJS API. `getDashboardData`
// is a thin, typed proxy over `GET /dashboard`; the aggregation
// (`summarizeDashboard`) still runs in the page over the returned bundle.

import { apiGet } from '@/lib/api/client'
import type {
  DashboardInvoice, DashboardPayment, DashboardPriorInvoice, DashboardOutstandingInvoice,
  DashboardWorkItem,
} from '@/lib/dashboard'

export type DashboardData = {
  invoices: DashboardInvoice[]
  payments: DashboardPayment[]
  priorInvoices: DashboardPriorInvoice[]
  lastYearInvoices: DashboardPriorInvoice[]
  outstandingInvoices: DashboardOutstandingInvoice[]
  workItems: DashboardWorkItem[]
  customerCount: number
}

type DashboardPaymentRow = {
  amount: number
  payment_date: string
  invoices:
    | { invoice_date: string; voided_at: string | null; deleted_at: string | null }
    | { invoice_date: string; voided_at: string | null; deleted_at: string | null }[]
    | null
}

const one = <T,>(rel: T | T[] | null | undefined): T | null =>
  Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)

// Pure helper retained for reuse/tests: flattens the to-one payment→invoice
// relation and drops payments whose invoice is voided/deleted. (The API applies
// the same rule server-side; this mirror keeps the shape documented + tested.)
export function normalizeDashboardPayments(rows: DashboardPaymentRow[]): DashboardPayment[] {
  return rows.flatMap((row) => {
    const inv = one(row.invoices)
    if (inv?.voided_at != null || inv?.deleted_at != null) return []
    return [{
      amount: Number(row.amount),
      payment_date: row.payment_date,
      invoice_date: inv?.invoice_date ?? null,
    }]
  })
}

export async function getDashboardData(from: string, to: string): Promise<DashboardData> {
  const qs = new URLSearchParams({ from, to })
  return apiGet<DashboardData>(`/dashboard?${qs.toString()}`)
}
