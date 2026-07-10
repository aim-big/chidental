import { redirect } from 'next/navigation'
import { requireSuperadmin } from '@/lib/auth/require-permission'
import { listRolesWithMeta } from '@/lib/auth/role-actions'
import RolesManager from '@/components/roles/RolesManager'

// Super Admin only — the role that owns role management. Data is server-rendered
// (service-role); the client no longer reads roles/permissions from the browser.
export default async function RolesPage() {
  const gate = await requireSuperadmin()
  if (!gate.ok) redirect('/dashboard')

  const initialRows = await listRolesWithMeta()
  return <RolesManager initialRows={initialRows} />
}
