// Sales Reports — server-first. The date range lives in the URL
// (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, defaulting to the current month) so the
// query + aggregation run on the server; changing the range re-navigates. The
// interactive UI (date inputs, tabs, tables, charts) is a single client island.

import { format, startOfMonth, endOfMonth } from 'date-fns'
import { getReportInvoices } from '@/data/reports'
import { summarizeReports } from '@/lib/reports'
import { ReportsClient } from '@/components/reports/ReportsClient'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const from = sp.from ?? format(startOfMonth(now), 'yyyy-MM-dd')
  const to = sp.to ?? format(endOfMonth(now), 'yyyy-MM-dd')

  const invoices = await getReportInvoices(from, to)
  const summary = summarizeReports(invoices, now.getTime())

  return <ReportsClient from={from} to={to} summary={summary} />
}
