import { redirect } from 'next/navigation'
import InvoiceForm from '@/components/invoices/InvoiceForm'
import { getInvoiceFormData } from '@/data/invoices'
import { requirePermission } from '@/lib/auth/require-permission'

export default async function InvoiceCreatePage() {
  // Hard gate: without invoices.create, the form is unreachable even by direct URL.
  const gate = await requirePermission('invoices.create')
  if (gate.ok === false) redirect('/invoices')

  const formData = await getInvoiceFormData()
  return <InvoiceForm formData={formData} />
}
