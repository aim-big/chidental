import { notFound, redirect } from 'next/navigation'
import CustomerForm from '@/components/customers/CustomerForm'
import { getCustomerForEdit } from '@/data/customers'
import { requirePermission } from '@/lib/auth/require-permission'

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const gate = await requirePermission('customers.edit')
  if (gate.ok === false) redirect(`/customers/${id}`)

  const customer = await getCustomerForEdit(id)
  if (!customer) notFound()
  return <CustomerForm initialData={customer} />
}
