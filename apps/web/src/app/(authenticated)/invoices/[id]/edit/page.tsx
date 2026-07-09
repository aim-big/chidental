import { notFound, redirect } from 'next/navigation'
import InvoiceForm from '@/components/invoices/InvoiceForm'
import { getInvoiceFormData, getInvoiceForEdit } from '@/data/invoices'
import { requirePermission } from '@/lib/auth/require-permission'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Editing a draft needs invoices.edit; viewers fall back to the read-only detail.
  const gate = await requirePermission('invoices.edit')
  if (gate.ok === false) redirect(`/invoices/${id}`)

  // Fetch the invoice first so its clinic can seed the picker include — this
  // keeps an archived clinic visible in the dropdown when editing its invoice.
  const editData = await getInvoiceForEdit(id)
  if (!editData) notFound()
  const formData = await getInvoiceFormData({ includeCustomerId: editData.invoice.customer_id })
  return <InvoiceForm invoiceId={id} formData={formData} editData={editData} />
}
