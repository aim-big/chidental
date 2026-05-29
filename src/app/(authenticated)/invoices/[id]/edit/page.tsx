import { Suspense } from 'react'
import InvoiceForm from '@/components/invoices/InvoiceForm'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <InvoiceForm invoiceId={id} />
    </Suspense>
  )
}
