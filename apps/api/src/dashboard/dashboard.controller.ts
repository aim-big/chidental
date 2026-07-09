import { Controller, Get, Query } from '@nestjs/common'
import { differenceInCalendarDays, addDays, format, subYears } from 'date-fns'
import { SupabaseService } from '../supabase/supabase.service'

// Read endpoint for the dashboard (strangler migration, module 5). Mirrors
// apps/web `src/data/dashboard.ts` getDashboardData() verbatim — the same 7
// parallel queries, the same prior/last-year window math, and the same payment
// + work-item normalization. Aggregation (summarizeDashboard) stays in the web
// page; this only returns the raw DashboardData bundle. All touched tables
// (invoices, customers, invoice_items, products, payments) have `using (true)`
// read policies, so the service-role client is behaviour-preserving.
const OUTSTANDING_STATUSES = ['sent', 'partial', 'overdue']

// supabase-js may return a to-one relation as an object or a 1-element array.
function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)
}

type PaymentRow = {
  amount: number
  payment_date: string
  invoices:
    | { invoice_date: string; voided_at: string | null; deleted_at: string | null }
    | { invoice_date: string; voided_at: string | null; deleted_at: string | null }[]
    | null
}

function normalizePayments(rows: PaymentRow[]) {
  return rows.flatMap((row) => {
    const inv = one(row.invoices)
    if (inv?.voided_at != null || inv?.deleted_at != null) return []
    return [{ amount: Number(row.amount), payment_date: row.payment_date, invoice_date: inv?.invoice_date ?? null }]
  })
}

/** The same-length window immediately before [from, to]. */
function priorRange(from: string, to: string): { from: string; to: string } {
  const span = differenceInCalendarDays(new Date(to), new Date(from))
  const priorTo = addDays(new Date(from), -1)
  const priorFrom = addDays(priorTo, -span)
  return { from: format(priorFrom, 'yyyy-MM-dd'), to: format(priorTo, 'yyyy-MM-dd') }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async data(@Query('from') from: string, @Query('to') to: string) {
    const prior = priorRange(from, to)
    const lastYear = {
      from: format(subYears(new Date(from), 1), 'yyyy-MM-dd'),
      to: format(subYears(new Date(to), 1), 'yyyy-MM-dd'),
    }

    const [invoicesRes, paymentsRes, priorRes, lastYearRes, outstandingRes, workRes, customersRes] =
      await Promise.all([
        this.supabase.admin
          .from('invoices')
          .select('*, customers(clinic_name), invoice_items(*, products(name))')
          .is('deleted_at', null)
          .gte('invoice_date', from)
          .lte('invoice_date', to),
        this.supabase.admin
          .from('payments')
          .select('amount, payment_date, invoices(invoice_date, voided_at, deleted_at)')
          .gte('payment_date', from)
          .lte('payment_date', to),
        this.supabase.admin
          .from('invoices')
          .select('total, customer_id, voided_at')
          .is('deleted_at', null)
          .gte('invoice_date', prior.from)
          .lte('invoice_date', prior.to),
        this.supabase.admin
          .from('invoices')
          .select('total, customer_id, voided_at')
          .is('deleted_at', null)
          .gte('invoice_date', lastYear.from)
          .lte('invoice_date', lastYear.to),
        this.supabase.admin
          .from('invoices')
          .select('total, amount_paid, status, voided_at, due_date')
          .in('status', OUTSTANDING_STATUSES)
          .is('voided_at', null)
          .is('deleted_at', null),
        this.supabase.admin
          .from('invoice_items')
          .select('work_status, invoices(voided_at, deleted_at)')
          .neq('work_status', 'delivered'),
        this.supabase.admin.from('customers').select('id', { count: 'exact', head: true }),
      ])

    if (invoicesRes.error) throw new Error(invoicesRes.error.message)

    const payments = normalizePayments((paymentsRes.data ?? []) as unknown as PaymentRow[])

    const workItems = (
      (workRes.data ?? []) as unknown as Array<{
        work_status: string
        invoices:
          | { voided_at: string | null; deleted_at: string | null }
          | { voided_at: string | null; deleted_at: string | null }[]
          | null
      }>
    )
      .filter((row) => {
        const inv = one(row.invoices)
        return inv != null && inv.voided_at == null && inv.deleted_at == null
      })
      .map((row) => ({ work_status: row.work_status }))

    return {
      invoices: invoicesRes.data ?? [],
      payments,
      priorInvoices: priorRes.data ?? [],
      lastYearInvoices: lastYearRes.data ?? [],
      outstandingInvoices: outstandingRes.data ?? [],
      workItems,
      customerCount: customersRes.count ?? 0,
    }
  }
}
