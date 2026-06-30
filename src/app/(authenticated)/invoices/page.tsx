import { redirect } from 'next/navigation'
import { getInvoicesPage, getInvoiceViewCounts, type InvoiceView } from '@/data/invoices'
import { parseListSearchParams } from '@/lib/list-url-state'
import { requirePermission } from '@/lib/auth/require-permission'
import { InvoiceListClient } from '@/components/invoices/InvoiceListClient'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Hard gate: no HTML (and no invoice data) is sent to a user lacking invoices.view.
  const gate = await requirePermission('invoices.view')
  if (gate.ok === false) redirect('/dashboard')

  const sp = await searchParams
  const state = parseListSearchParams(sp, 'all')
  const view = state.view as InvoiceView

  const [pageData, counts] = await Promise.all([
    getInvoicesPage({ q: state.q, view, page: state.page, sort: state.sort, dir: state.dir }),
    getInvoiceViewCounts(),
  ])

  return <InvoiceListClient page={pageData} counts={counts} state={state} />
}
