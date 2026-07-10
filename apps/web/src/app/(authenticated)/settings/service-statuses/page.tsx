import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'
import { getServiceStatuses } from '@/data/settings-taxonomies'
import ServiceStatusesClient from './ServiceStatusesClient'

// Server gate + server-rendered initial data: without settings.manage the page
// (and its data) never renders — no flash, no client-only redirect, no browser
// Supabase read. RLS on service_statuses is the backstop; this is
// defense-in-depth + clean UX.
export default async function ServiceStatusesPage() {
  const gate = await requirePermission('settings.manage')
  if (gate.ok === false) redirect('/dashboard')

  const initialRows = await getServiceStatuses()
  return <ServiceStatusesClient initialRows={initialRows} />
}
