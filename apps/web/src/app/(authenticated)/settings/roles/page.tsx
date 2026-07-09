import { redirect } from 'next/navigation'
import { requireSuperadmin } from '@/lib/auth/require-permission'
import RolesManager from '@/components/roles/RolesManager'

// Super Admin only — the role that owns role management.
export default async function RolesPage() {
  const gate = await requireSuperadmin()
  if (!gate.ok) redirect('/dashboard')

  return <RolesManager />
}
