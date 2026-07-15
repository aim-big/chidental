'use client'

// Header (number + payment-status / voided badges) and the workflow action
// bar: Issue Invoice, Record Payment (dialog), Edit link, Print Invoice / Delivery,
// and Void (dialog). Each mutation calls a Server Action and reports
// through the toast; success triggers `router.refresh()` so the server re-renders
// with fresh data. Payment goes through the atomic `record_payment` RPC, which
// records the full outstanding balance and advances status — we never recompute
// status client-side.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/feedback/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { cn, formatCurrency, todayISODate } from '@/lib/utils'
import { ArrowLeft, Printer, CreditCard, Ban, Pencil, ChevronDown, FileText, Truck, CheckCircle2, Trash2, ArchiveRestore } from 'lucide-react'
import { canEditInvoice } from '@/lib/invoice-permissions'
import { isVoided } from '@chidental/shared'
import { statusBadgeVariant, paymentStatusLabel } from '@/lib/status-badge'
import {
  markSentAction,
  recordPaymentAction,
} from '@/data/invoice-actions'
import { voidInvoice as voidInvoiceAction } from '@/lib/invoices/void-actions'
import { softDeleteInvoiceAction, restoreVoidedInvoiceAction } from '@/lib/admin/admin-actions'
import type { InvoiceDetail } from '@/data/invoices'

const paymentSchema = z.object({
  payment_date: z.string().min(1),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
})
type PaymentForm = z.infer<typeof paymentSchema>

type PrintMode = 'invoice' | 'delivery' | 'work_ticket'

export type ActionsBarProps = {
  invoice: InvoiceDetail
  customerName: string | null
  /** max(0, total - totalPaid) — the full balance recorded by Record Payment. */
  unrecorded: number
  /** Opens the print dialog owned by the document island. */
  onPrint: (mode: PrintMode) => void
}

// Single "Print" entry point that reveals the printable documents (Invoice and
// Delivery Order) on hover or click — keeping print apart from the workflow
// actions. Work Ticket prints are still wired through `onPrint` in the document
// island but are no longer surfaced here. Hover opens with a small close delay
// so moving the cursor from the button onto the panel doesn't dismiss it;
// click toggles it for touch/keyboard, with outside-click and Escape to close.
function PrintMenu({ onPrint, className }: { onPrint: (mode: PrintMode) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openNow = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    setOpen(true)
  }
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Clean up the pending close timer on unmount.
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  const choose = (mode: PrintMode) => { setOpen(false); onPrint(mode) }

  const items: { mode: PrintMode; label: string; description: string; icon: typeof FileText }[] = [
    { mode: 'invoice', label: 'Invoice', description: 'Prices, totals & bank details', icon: FileText },
    { mode: 'delivery', label: 'Delivery Order', description: 'Items & quantities, no prices', icon: Truck },
  ]

  return (
    <div ref={containerRef} className={cn('relative', className)} onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Printer className="h-4 w-4 mr-2" />Print
        <ChevronDown className={cn('h-4 w-4 ml-1.5 opacity-60 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md sm:left-auto sm:min-w-[14rem]"
        >
          {items.map(({ mode, label, description, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              role="menuitem"
              onClick={() => choose(mode)}
              className="flex w-full items-start gap-2.5 rounded-sm px-2 py-2 text-left outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
              <span className="flex flex-col">
                <span className="text-sm font-medium leading-none">{label}</span>
                <span className="mt-1 text-xs text-muted-foreground">{description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ActionsBar({ invoice, customerName, unrecorded, onPrint }: ActionsBarProps) {
  const router = useRouter()
  const { hasPermission, isSuperadmin } = useAuth()
  const { show } = useToast()

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [restoringVoid, setRestoringVoid] = useState(false)

  const { register, handleSubmit, reset } = useForm<PaymentForm>({
    // Cast keeps RHF's Resolver generics aligned with the zod schema's inferred type.
    resolver: zodResolver(paymentSchema) as Resolver<PaymentForm>,
    defaultValues: { payment_date: todayISODate() },
  })

  const voided = isVoided(invoice)
  const canEdit = canEditInvoice(invoice, hasPermission)

  const onRecordPayment = async (data: PaymentForm) => {
    setSavingPayment(true)
    // The atomic RPC inserts the payment row AND advances status in one call;
    // amount is always the full outstanding balance. We refresh afterward —
    // no client-side status recompute.
    const res = await recordPaymentAction(invoice.id, {
      amount: unrecorded,
      payment_date: data.payment_date,
      reference: data.reference_number || undefined,
      notes: data.notes || undefined,
    })
    setSavingPayment(false)
    if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
    setPaymentOpen(false)
    reset()
    show({ variant: 'success', title: 'Payment recorded' })
    router.refresh()
  }

  const markAsSent = async () => {
    const res = await markSentAction(invoice.id)
    if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
    show({ variant: 'success', title: 'Invoice issued' })
    router.refresh()
  }

  const voidInvoice = async () => {
    setVoiding(true)
    try {
      const res = await voidInvoiceAction({ id: invoice.id, reason: voidReason })
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      setVoidOpen(false)
      setVoidReason('')
      show({ variant: 'success', title: 'Invoice voided' })
      router.refresh()
    } catch {
      // The action returns a friendly message via `res.error`; this only fires
      // on an unexpected client/transport failure. Keep it generic — never
      // surface a raw (masked) server error string to the user.
      show({ variant: 'error', title: 'Could not void the invoice. Please try again.' })
    } finally {
      setVoiding(false)
    }
  }

  // Super Admin: soft-delete hides the invoice everywhere (recoverable from the
  // Admin Console recycle bin). The detail page would 404 afterward, so navigate
  // back to the list on success.
  const deleteInvoice = async () => {
    setDeleting(true)
    try {
      const res = await softDeleteInvoiceAction({ id: invoice.id, reason: deleteReason })
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      show({ variant: 'success', title: 'Invoice deleted' })
      router.push('/invoices')
    } finally {
      setDeleting(false)
    }
  }

  // Super Admin: undo a wrongful void (the trigger blocks this for everyone else).
  const restoreVoid = async () => {
    setRestoringVoid(true)
    try {
      const res = await restoreVoidedInvoiceAction({ id: invoice.id })
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      show({ variant: 'success', title: 'Invoice restored from void' })
      router.refresh()
    } finally {
      setRestoringVoid(false)
    }
  }

  return (
    <div className="print:hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{invoice.invoice_number}</h1>
              <Badge variant={statusBadgeVariant('payment', invoice.status)}>{paymentStatusLabel(invoice.status)}</Badge>
              {voided && (
                <Badge variant="destructive" className="uppercase">Voided</Badge>
              )}
            </div>
            <Link href={`/customers/${invoice.customer_id}`} className="text-sm text-brand hover:underline">
              {customerName}
            </Link>
          </div>
        </div>
        {/* Mobile: a 2-up grid keeps every action visible at half the height of a
            full-width stack. sm+: the usual wrapping row. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {/* Issuing is the key state transition for a draft, so it's the primary
              (colored) CTA. The tooltip spells out the consequence — it finalizes
              the invoice and locks it from staff editing. */}
          {!voided && invoice.status === 'draft' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="w-full sm:w-auto" size="sm" onClick={markAsSent}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />Issue Invoice
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Finalize this draft into an official invoice ready to bill. Staff can no longer edit it afterward.
              </TooltipContent>
            </Tooltip>
          )}
          {/* Record Payment is the single settle action: it records the full
              outstanding balance and marks the invoice paid. Hidden once paid so
              a second full payment can't be recorded. */}
          {!voided && ['sent', 'partial', 'overdue'].includes(invoice.status) && (
            <Button className="w-full sm:w-auto" size="sm" onClick={() => { reset({ payment_date: todayISODate() }); setPaymentOpen(true) }}>
              <CreditCard className="h-4 w-4 mr-2" />Record Payment
            </Button>
          )}
          {canEdit && (
            <Button className="w-full sm:w-auto" variant="outline" size="sm" asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />Edit
              </Link>
            </Button>
          )}
          {hasPermission('invoices.manage') && !voided && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-danger/30 text-danger hover:border-danger/50 hover:bg-danger-subtle hover:text-danger sm:w-auto"
              onClick={() => setVoidOpen(true)}
            >
              <Ban className="h-4 w-4 mr-2" />Void
            </Button>
          )}
          {/* Super Admin restore-from-void: only shown on a voided invoice. */}
          {isSuperadmin && voided && (
            <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={restoreVoid} disabled={restoringVoid}>
              <ArchiveRestore className="h-4 w-4 mr-2" />{restoringVoid ? 'Restoring…' : 'Restore from void'}
            </Button>
          )}
          {/* Super Admin delete: hides the invoice (recoverable in Admin Console). */}
          {isSuperadmin && (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-danger/30 text-danger hover:border-danger/50 hover:bg-danger-subtle hover:text-danger sm:w-auto"
              onClick={() => { setDeleteReason(''); setDeleteOpen(true) }}
            >
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </Button>
          )}
          {/* Print is kept apart from the workflow actions: a single entry point on
              the right that reveals the printable documents on hover or click. */}
          <PrintMenu onPrint={onPrint} className="w-full sm:w-auto" />
        </div>
      </div>

      {/* Void confirmation dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <Ban className="h-5 w-5" /> Void Invoice
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Void <span className="font-semibold">{invoice.invoice_number}</span>? It will be excluded
            from revenue and reports. Only a Super Admin can restore it afterward.
          </DialogDescription>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="e.g. duplicate, entry error" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={voidInvoice}
              disabled={voiding}
            >
              {voiding ? 'Voiding…' : 'Yes, Void Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Super Admin delete (soft-delete) dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <Trash2 className="h-5 w-5" /> Delete Invoice
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Delete <span className="font-semibold">{invoice.invoice_number}</span>? It will be hidden
            from all lists and reports. You can restore it from the Admin Console recycle bin.
          </DialogDescription>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="e.g. test data, created in error" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={deleteInvoice} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription className="sr-only">
              Record the full outstanding balance as a single payment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onRecordPayment)} className="space-y-4">
            <div className="space-y-1">
              <Label>Amount (MYR)</Label>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(unrecorded)}</p>
              <p className="text-xs text-muted-foreground">Full outstanding balance — recorded as a single payment.</p>
            </div>
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input type="date" {...register('payment_date')} />
            </div>
            <div className="space-y-2">
              <Label>Bank Transfer Reference</Label>
              <Input placeholder="e.g. TT123456" {...register('reference_number')} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} placeholder="Optional notes…" {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingPayment || unrecorded <= 0}>{savingPayment ? 'Saving…' : 'Record Payment'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
