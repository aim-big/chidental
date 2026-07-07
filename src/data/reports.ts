// Server-side READ query for the Sales Reports page. Mirrors the date-ranged
// query the old client page ran; aggregation happens in `@/lib/reports`.

import { createClient } from '@/lib/supabase/server'
import type { ReportInvoice, ReportPayment } from '@/lib/reports'

export async function getReportInvoices(from: string, to: string): Promise<ReportInvoice[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('invoices')
    .select('*, customers(clinic_name), invoice_items(*, products(name))')
    .is('deleted_at', null)
    .gte('invoice_date', from)
    .lte('invoice_date', to)
  // The query selects narrowed projections (clinic_name, product name), so cast
  // through `unknown` to the report relation type.
  return (data ?? []) as unknown as ReportInvoice[]
}

// Payments actually collected in the range, joined to their invoice + clinic.
// The nested relations are to-one; supabase-js may return them as an object or
// a single-element array depending on FK detection, so normalise both.
export async function getReportPayments(from: string, to: string): Promise<ReportPayment[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select('amount, payment_date, reference_number, invoice_id, invoices(invoice_number, invoice_date, voided_at, deleted_at, customers(clinic_name))')
    .gte('payment_date', from)
    .lte('payment_date', to)
    .order('payment_date')

  const one = <T,>(rel: T | T[] | null | undefined): T | null =>
    Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null)

  return (data ?? []).flatMap((row) => {
    const inv = one(row.invoices as unknown as {
      invoice_number: string
      invoice_date: string
      voided_at: string | null
      deleted_at: string | null
      customers: unknown
    } | null)
    if (inv?.voided_at != null || inv?.deleted_at != null) return []
    const cust = one((inv?.customers ?? null) as unknown as { clinic_name: string } | null)
    return [{
      amount: Number(row.amount),
      payment_date: row.payment_date as string,
      reference_number: (row.reference_number as string | null) ?? null,
      invoice_id: (row.invoice_id as string | null) ?? null,
      invoice_number: inv?.invoice_number ?? null,
      invoice_date: inv?.invoice_date ?? null,
      clinic_name: cust?.clinic_name ?? null,
    }]
  })
}
