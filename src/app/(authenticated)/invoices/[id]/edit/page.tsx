import { notFound } from 'next/navigation'
import InvoiceForm from '@/components/invoices/InvoiceForm'
import { getInvoiceFormData, getInvoiceForEdit } from '@/data/invoices'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [formData, editData] = await Promise.all([
    getInvoiceFormData(),
    getInvoiceForEdit(id),
  ])
  if (!editData) notFound()
  return <InvoiceForm invoiceId={id} formData={formData} editData={editData} />
}
