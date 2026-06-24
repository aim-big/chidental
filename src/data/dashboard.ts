// Server-side READ query for the dashboard. Runs inside the Server Component via
// the SSR client (RLS-aware). Fetches the date-ranged invoices + payments, plus
// a same-length prior period for growth, then `summarizeDashboard` aggregates.

import { differenceInCalendarDays, addDays, format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import type {
  DashboardInvoice, DashboardPayment, DashboardPriorInvoice, DashboardOutstandingInvoice,
} from '@/lib/dashboard'

export type DashboardData = {
  invoices: DashboardInvoice[]
  payments: DashboardPayment[]
  priorInvoices: DashboardPriorInvoice[]
  outstandingInvoices: DashboardOutstandingInvoice[]
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

  const [invoicesRes, paymentsRes, priorRes, outstandingRes, customersRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, customers(clinic_name), invoice_items(*, products(name))')
      .is('deleted_at', null)
      .gte('invoice_date', from)
      .lte('invoice_date', to),
    supabase
      .from('payments')
      .select('amount, payment_date')
      .gte('payment_date', from)
      .lte('payment_date', to),
    supabase
      .from('invoices')
      .select('total, customer_id, voided_at')
      .is('deleted_at', null)
      .gte('invoice_date', prior.from)
      .lte('invoice_date', prior.to),
    // All-time outstanding snapshot (money owed right now, range-independent).
    supabase
      .from('invoices')
      .select('total, status, voided_at')
      .in('status', OUTSTANDING_STATUSES)
      .is('voided_at', null)
      .is('deleted_at', null),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
  ])

  return {
    invoices: (invoicesRes.data ?? []) as unknown as DashboardInvoice[],
    payments: (paymentsRes.data ?? []) as DashboardPayment[],
    priorInvoices: (priorRes.data ?? []) as DashboardPriorInvoice[],
    outstandingInvoices: (outstandingRes.data ?? []) as DashboardOutstandingInvoice[],
    customerCount: customersRes.count ?? 0,
  }
}
