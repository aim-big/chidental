// Work queue — server-first. The page is an async Server Component that reads the
// queue through the `src/data/` seam (RLS-aware SSR client) and hands plain,
// serializable rows/stages to the client island, which owns the interactive UI
// (Board/List toggle, Kanban DnD, item-based list, filter, search, optimistic moves).

import { redirect } from 'next/navigation'
import { getWorkQueue } from '@/data/work'
import { requirePermission } from '@/lib/auth/require-permission'
import { WorkViewToggle } from '@/components/work/WorkViewToggle'

export default async function WorkPage() {
  // The work queue is built from invoice line items, so it shares invoices.view.
  const gate = await requirePermission('invoices.view')
  if (gate.ok === false) redirect('/dashboard')

  const { rows, stages, statusConfigs } = await getWorkQueue()
  return <WorkViewToggle rows={rows} stages={stages} statusConfigs={statusConfigs} />
}
