import { Suspense } from 'react'
import InvoiceForm from '@/components/invoices/InvoiceForm'

export default function InvoiceCreatePage() {
  return (
    <Suspense>
      <InvoiceForm />
    </Suspense>
  )
}
