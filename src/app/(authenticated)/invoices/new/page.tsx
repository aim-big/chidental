import InvoiceForm from '@/components/invoices/InvoiceForm'
import { getInvoiceFormData } from '@/data/invoices'

export default async function InvoiceCreatePage() {
  const formData = await getInvoiceFormData()
  return <InvoiceForm formData={formData} />
}
