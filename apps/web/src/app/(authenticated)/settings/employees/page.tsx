import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'
import { listEmployees, listAssignableRoles } from '@/lib/auth/employee-actions'
import EmployeesManager from '@/components/employees/EmployeesManager'

// manageEmployees only. Enforced server-side so non-holders can't reach the page
// even if the nav item were exposed. Data is server-rendered (service-role);
// the client no longer reads the directory from the browser.
export default async function EmployeesPage() {
  const gate = await requirePermission('staff.manage')
  if (!gate.ok) redirect('/dashboard')

  const [initialRows, initialRoles] = await Promise.all([listEmployees(), listAssignableRoles()])
  return <EmployeesManager currentUserId={gate.userId} initialRows={initialRows} initialRoles={initialRoles} />
}
