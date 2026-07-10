import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'
import { getWorkStatusConfigs } from '@/data/settings-taxonomies'
import WorkStatusesClient from './WorkStatusesClient'

// Server gate + server-rendered initial data — see service-statuses/page.tsx.
export default async function WorkStatusesPage() {
  const gate = await requirePermission('settings.manage')
  if (gate.ok === false) redirect('/dashboard')

  const initialRows = await getWorkStatusConfigs()
  return <WorkStatusesClient initialRows={initialRows} />
}
