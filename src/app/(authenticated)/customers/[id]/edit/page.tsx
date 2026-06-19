import { notFound } from 'next/navigation'
import CustomerForm from '@/components/customers/CustomerForm'
import { getCustomerForEdit } from '@/data/customers'

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await getCustomerForEdit(id)
  if (!customer) notFound()
  return <CustomerForm initialData={customer} />
}
