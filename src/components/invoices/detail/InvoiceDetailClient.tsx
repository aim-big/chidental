'use client'

// Thin orchestrator that wires the two coupled chrome islands together: the
// ActionsBar's Print buttons need to open the print dialog that lives inside the
// InvoiceDocument island. They share a mutable opener via a ref, so neither has
// to hoist the print dialog's state. `canEdit` (for the recipient pencil) is
// derived here from the client auth context.

import { useRef, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { canEditInvoice } from '@/lib/invoice-permissions'
import { isVoided } from '@/lib/invoice-status'
import { ActionsBar } from './ActionsBar'
import { InvoiceDocument } from './InvoiceDocument'
import type { InvoiceItem, Product, ServiceStatus, WorkStatus } from '@/lib/database.types'
import type { InvoiceDetail } from '@/data/invoices'

type PrintMode = 'invoice' | 'delivery'

export type InvoiceDetailClientProps = {
  invoice: InvoiceDetail
  items: InvoiceItem[]
  products: Product[]
  serviceStatuses: ServiceStatus[]
  currentServiceStatus: ServiceStatus | null
  customerName: string | null
  totalPaid: number
  unrecorded: number
  /** Rolled-up (dominant) work status, for the Advance-work-status action. */
  dominantWork: WorkStatus | null
  /** Editors + status strip, rendered between the actions bar and the printable document. */
  children?: ReactNode
}

export function InvoiceDetailClient({
  invoice,
  items,
  products,
  serviceStatuses,
  currentServiceStatus,
  customerName,
  totalPaid,
  unrecorded,
  dominantWork,
  children,
}: InvoiceDetailClientProps) {
  const { hasPermission } = useAuth()
  const printOpenRef = useRef<(mode: PrintMode) => void>(() => {})

  const canEdit = canEditInvoice(invoice, hasPermission) && !isVoided(invoice)

  return (
    <>
      <ActionsBar
        invoice={invoice}
        customerName={customerName}
        unrecorded={unrecorded}
        dominantWork={dominantWork}
        onPrint={mode => printOpenRef.current(mode)}
      />
      {children}
      <InvoiceDocument
        invoice={invoice}
        items={items}
        products={products}
        serviceStatuses={serviceStatuses}
        currentServiceStatus={currentServiceStatus}
        totalPaid={totalPaid}
        canEdit={canEdit}
        onPrintReady={open => { printOpenRef.current = open }}
      />
    </>
  )
}
