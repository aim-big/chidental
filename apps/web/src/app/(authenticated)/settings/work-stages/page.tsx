import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'
import { getWorkStages } from '@/data/settings-taxonomies'
import WorkStagesClient from './WorkStagesClient'

// Server gate + server-rendered initial data — see service-statuses/page.tsx.
export default async function WorkStagesPage() {
  const gate = await requirePermission('settings.manage')
  if (gate.ok === false) redirect('/dashboard')

  const initialRows = await getWorkStages()
  return <WorkStagesClient initialRows={initialRows} />
}
