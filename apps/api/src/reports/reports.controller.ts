import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { dateRangeQuerySchema } from '@chidental/shared'
import { SupabaseService } from '../supabase/supabase.service'

// Parse the shared date-range contract or throw a 400. Keeps a malformed/missing
// range from reaching Postgres as an undefined bound (which returns a confusing
// 500 rather than the clear "bad request" the caller deserves).
function parseRange(from: string, to: string): { from: string; to: string } {
  const parsed = dateRangeQuerySchema.safeParse({ from, to })
  if (!parsed.success) {
    throw new BadRequestException('`from` and `to` must be YYYY-MM-DD dates')
  }
  return parsed.data
}

// Read endpoints for the Sales Reports page (strangler migration, module 6).
// Mirror apps/web `src/data/reports.ts` verbatim — the same date-ranged queries
// and the same to-one relation normalization (voided/deleted parents dropped).
// Aggregation stays in the web page (`@/lib/reports`); these return raw rows.
// invoices / payments / customers / invoice_items / products read policies are
// all `using (true)`, so the service-role client is behaviour-preserving.

// supabase-js may return a to-one relation as an object or a 1-element array.
function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly supabase: SupabaseService) {}

  // Mirrors getReportInvoices(): date-ranged, non-deleted, with clinic + items.
  @Get('invoices')
  async invoices(@Query('from') fromRaw: string, @Query('to') toRaw: string) {
    const { from, to } = parseRange(fromRaw, toRaw)
    const { data, error } = await this.supabase.admin
      .from('invoices')
      .select('*, customers(clinic_name), invoice_items(*, products(name))')
      .is('deleted_at', null)
      .gte('invoice_date', from)
      .lte('invoice_date', to)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Mirrors getReportPayments(): payments in range, joined to invoice + clinic,
  // with voided/deleted parents dropped and to-one relations normalized.
  @Get('payments')
  async payments(@Query('from') fromRaw: string, @Query('to') toRaw: string) {
    const { from, to } = parseRange(fromRaw, toRaw)
    const { data, error } = await this.supabase.admin
      .from('payments')
      .select(
        'amount, payment_date, reference_number, invoice_id, invoices(invoice_number, invoice_date, voided_at, deleted_at, customers(clinic_name))',
      )
      .gte('payment_date', from)
      .lte('payment_date', to)
      .order('payment_date')
    if (error) throw new Error(error.message)

    return (data ?? []).flatMap((row) => {
      const inv = one(
        row.invoices as unknown as {
          invoice_number: string
          invoice_date: string
          voided_at: string | null
          deleted_at: string | null
          customers: unknown
        } | null,
      )
      if (inv?.voided_at != null || inv?.deleted_at != null) return []
      const cust = one((inv?.customers ?? null) as unknown as { clinic_name: string } | null)
      return [
        {
          amount: Number(row.amount),
          payment_date: row.payment_date as string,
          reference_number: (row.reference_number as string | null) ?? null,
          invoice_id: (row.invoice_id as string | null) ?? null,
          invoice_number: inv?.invoice_number ?? null,
          invoice_date: inv?.invoice_date ?? null,
          clinic_name: cust?.clinic_name ?? null,
        },
      ]
    })
  }
}
