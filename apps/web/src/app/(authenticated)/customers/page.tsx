import { redirect } from 'next/navigation'
import { getCustomersPage, type CustomerView } from '@/data/customers'
import { parseListSearchParams } from '@/lib/list-url-state'
import { requirePermission } from '@/lib/auth/require-permission'
import { CustomerListClient } from '@/components/customers/CustomerListClient'

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const gate = await requirePermission('customers.view')
  if (gate.ok === false) redirect('/dashboard')

  const sp = await searchParams
  const state = parseListSearchParams(sp, 'active')
  const view = (['active', 'archived', 'all'].includes(state.view) ? state.view : 'active') as CustomerView
  const page = await getCustomersPage({ q: state.q, page: state.page, sort: state.sort, dir: state.dir, view })
  return <CustomerListClient page={page} state={state} />
}
