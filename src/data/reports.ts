// Server-side READ query for the Sales Reports page. Mirrors the date-ranged
// query the old client page ran; aggregation happens in `@/lib/reports`.

import { createClient } from '@/lib/supabase/server'
import type { ReportInvoice } from '@/lib/reports'

export async function getReportInvoices(from: string, to: string): Promise<ReportInvoice[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('invoices')
    .select('*, customers(clinic_name), invoice_items(*, products(name))')
    .gte('invoice_date', from)
    .lte('invoice_date', to)
  // The query selects narrowed projections (clinic_name, product name), so cast
  // through `unknown` to the report relation type.
  return (data ?? []) as unknown as ReportInvoice[]
}
