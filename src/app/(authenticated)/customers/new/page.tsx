import { redirect } from 'next/navigation'
import CustomerForm from '@/components/customers/CustomerForm'
import { requirePermission } from '@/lib/auth/require-permission'

export default async function NewCustomerPage() {
  const gate = await requirePermission('customers.edit')
  if (gate.ok === false) redirect('/customers')

  return <CustomerForm />
}
