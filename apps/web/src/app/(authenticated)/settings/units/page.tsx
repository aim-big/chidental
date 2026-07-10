import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'
import { getUnits } from '@/data/settings-taxonomies'
import UnitsClient from './UnitsClient'

// Server gate + server-rendered initial data — the client no longer reads Supabase.
export default async function UnitsPage() {
  const gate = await requirePermission('settings.manage')
  if (gate.ok === false) redirect('/dashboard')

  const initialRows = await getUnits()
  return <UnitsClient initialRows={initialRows} />
}
