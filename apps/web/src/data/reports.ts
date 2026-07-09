// Server-side READ query for the Sales Reports page.
//
// The reports module is served entirely by the NestJS API. Each function is a
// thin, typed proxy; aggregation still happens in `@/lib/reports` over the
// returned rows.

import { apiGet } from '@/lib/api/client'
import type { ReportInvoice, ReportPayment } from '@/lib/reports'

export async function getReportInvoices(from: string, to: string): Promise<ReportInvoice[]> {
  const qs = new URLSearchParams({ from, to })
  return apiGet<ReportInvoice[]>(`/reports/invoices?${qs.toString()}`)
}

// Payments collected in the range, joined to their invoice + clinic, with
// voided/deleted parents dropped (normalized server-side).
export async function getReportPayments(from: string, to: string): Promise<ReportPayment[]> {
  const qs = new URLSearchParams({ from, to })
  return apiGet<ReportPayment[]>(`/reports/payments?${qs.toString()}`)
}
