// Server-side READ query for the dashboard. Runs inside the Server Component via
// the SSR client (RLS-aware). Fetches the date-ranged invoices + payments, plus
// a same-length prior period for growth, then `summarizeDashboard` aggregates.

import { differenceInCalendarDays, addDays, format, subYears } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
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

const OUTSTANDING_STATUSES = ['sent', 'partial', 'overdue']

/** The same-length window immediately before [from, to]. */
function priorRange(from: string, to: string): { from: string; to: string } {
  const span = differenceInCalendarDays(new Date(to), new Date(from)) // inclusive length - 1
  const priorTo = addDays(new Date(from), -1)
  const priorFrom = addDays(priorTo, -span)
  return { from: format(priorFrom, 'yyyy-MM-dd'), to: format(priorTo, 'yyyy-MM-dd') }
}

export async function getDashboardData(from: string, to: string): Promise<DashboardData> {
  const supabase = await createClient()
  const prior = priorRange(from, to)
  // The same calendar window one year earlier, for the YoY comparison.
  const lastYear = {
    from: format(subYears(new Date(from), 1), 'yyyy-MM-dd'),
    to: format(subYears(new Date(to), 1), 'yyyy-MM-dd'),
  }

  const [invoicesRes, paymentsRes, priorRes, lastYearRes, outstandingRes, workRes, customersRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, customers(clinic_name), invoice_items(*, products(name))')
      .is('deleted_at', null)
      .gte('invoice_date', from)
      .lte('invoice_date', to),
    // The joined invoice's issue date feeds avg-days-to-collect.
    supabase
      .from('payments')
      .select('amount, payment_date, invoices(invoice_date)')
      .gte('payment_date', from)
      .lte('payment_date', to),
    supabase
      .from('invoices')
      .select('total, customer_id, voided_at')
      .is('deleted_at', null)
      .gte('invoice_date', prior.from)
      .lte('invoice_date', prior.to),
    supabase
      .from('invoices')
      .select('total, customer_id, voided_at')
      .is('deleted_at', null)
      .gte('invoice_date', lastYear.from)
      .lte('invoice_date', lastYear.to),
    // All-time outstanding snapshot (money owed right now, range-independent).
    supabase
      .from('invoices')
      .select('total, status, voided_at, due_date')
      .in('status', OUTSTANDING_STATUSES)
      .is('voided_at', null)
      .is('deleted_at', null),
    // Undelivered work items = jobs on the floor. Parent voided/deleted
    // invoices are filtered below (same rule as the Work queue).
    supabase
      .from('invoice_items')
      .select('work_status, invoices(voided_at, deleted_at)')
      .neq('work_status', 'delivered'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
  ])

  // supabase-js may return a to-one relation as an object or a 1-element array.
  const one = <T,>(rel: T | T[] | null | undefined): T | null =>
    Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)

  const payments: DashboardPayment[] = ((paymentsRes.data ?? []) as unknown as Array<{
    amount: number
    payment_date: string
    invoices: { invoice_date: string } | { invoice_date: string }[] | null
  }>).map((row) => ({
    amount: Number(row.amount),
    payment_date: row.payment_date,
    invoice_date: one(row.invoices)?.invoice_date ?? null,
  }))

  const workItems: DashboardWorkItem[] = ((workRes.data ?? []) as unknown as Array<{
    work_status: string
    invoices: { voided_at: string | null; deleted_at: string | null } | { voided_at: string | null; deleted_at: string | null }[] | null
  }>)
    .filter((row) => {
      const inv = one(row.invoices)
      return inv != null && inv.voided_at == null && inv.deleted_at == null
    })
    .map((row) => ({ work_status: row.work_status }))

  return {
    invoices: (invoicesRes.data ?? []) as unknown as DashboardInvoice[],
    payments,
    priorInvoices: (priorRes.data ?? []) as DashboardPriorInvoice[],
    lastYearInvoices: (lastYearRes.data ?? []) as DashboardPriorInvoice[],
    outstandingInvoices: (outstandingRes.data ?? []) as DashboardOutstandingInvoice[],
    workItems,
    customerCount: customersRes.count ?? 0,
  }
}
