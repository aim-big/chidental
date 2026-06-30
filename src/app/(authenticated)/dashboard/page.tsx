// Dashboard — server-first. The date range lives in the URL
// (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, defaulting to the current month) so the
// query + aggregation run on the server; changing the range re-navigates. The
// interactive UI (date inputs, KPI cards, charts) is a single client island.

import { format, startOfMonth, endOfMonth } from 'date-fns'
import { getDashboardData } from '@/data/dashboard'
import { summarizeDashboard } from '@/lib/dashboard'
import { requirePermission } from '@/lib/auth/require-permission'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const from = sp.from ?? format(startOfMonth(now), 'yyyy-MM-dd')
  const to = sp.to ?? format(endOfMonth(now), 'yyyy-MM-dd')

  const { invoices, payments, priorInvoices, outstandingInvoices, customerCount } = await getDashboardData(from, to)
  const summary = summarizeDashboard({ invoices, payments, priorInvoices, outstandingInvoices, from, to })
  const canCreateInvoice = (await requirePermission('invoices.create')).ok

  return (
    <DashboardClient
      from={from}
      to={to}
      summary={summary}
      customerCount={customerCount}
      canCreateInvoice={canCreateInvoice}
    />
  )
}
