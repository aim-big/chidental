import { getCustomers } from '@/data/customers'
import { CustomerListClient } from '@/components/customers/CustomerListClient'

export default async function CustomersPage() {
  const customers = await getCustomers()
  return <CustomerListClient customers={customers} />
}
