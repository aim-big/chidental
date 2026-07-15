// Invoice detail — server-first. This Server Component fetches the whole bundle
// via `getInvoiceDetail`, computes the money totals, and renders the read-only
// sections (printable document chrome + payment history) server-side. Every
// interactive section is a client island under `@/components/invoices/detail/`
// that receives its data slice and calls a Server Action.
//
// Layout is editors-first: the at-a-glance status strip and the daily editors
// (work status, service status, case details) render between the actions bar and
// the printable document, so staff no longer scroll past the whole invoice to
// update a case.

import { notFound, redirect } from 'next/navigation'
import { getInvoiceDetail } from '@/data/invoices'
import { getBillingSettings } from '@/data/billing-settings'
import { requirePermission } from '@/lib/auth/require-permission'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { StatusPill, statusTone } from '@/components/ui/status-pill'
import { Money } from '@/components/ui/money'
import { cn, formatDate } from '@/lib/utils'
import { isVoided } from '@chidental/shared'
import { paymentStatusLabel } from '@/lib/status-badge'
import { DEFAULT_COLOR } from '@/lib/service-status'
import { InvoiceDetailClient } from '@/components/invoices/detail/InvoiceDetailClient'
import { CaseDetailsEditor } from '@/components/invoices/detail/CaseDetailsEditor'
import { WorkStatusEditor } from '@/components/invoices/detail/WorkStatusEditor'
import { InvoiceActivityPanel } from '@/components/invoices/detail/InvoiceActivityPanel'
import { getInvoiceActivity } from '@/data/invoice-activity'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Hard gate: the invoice bundle is fetched and embedded server-side, so it must
  // never render for a user lacking invoices.view (not even for the 1s flash).
  const gate = await requirePermission('invoices.view')
  if (gate.ok === false) redirect('/dashboard')

  const { id } = await params
  const [data, billingSettings, activity] = await Promise.all([
    getInvoiceDetail(id),
    getBillingSettings(),
    getInvoiceActivity(id),
  ])
  if (!data) notFound()

  const { invoice, items, payments, history, products, stages, workStatusConfigs, serviceStatuses } = data
  const customer = invoice.customers ?? null

  // Money model — computed server-side, mirroring the original page exactly.
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  // When an invoice is settled (status 'paid'), the balance is zero even if the
  // recorded payments don't sum to the total — e.g. it was marked paid directly.
  const outstanding = invoice.status === 'paid' ? 0 : Number(invoice.total) - totalPaid
  // Pre-fills Record Payment. Unlike `outstanding`, this stays the real unrecorded
  // balance for a 'paid' invoice settled via the shortcut, so the field isn't blank.
  const unrecorded = Math.max(0, Number(invoice.total) - totalPaid)

  // The service status shown on the printed doc (selected id, falling back to the
  // embedded relation), resolved server-side.
  const currentServiceStatus =
    serviceStatuses.find(s => s.id === invoice.service_status_id) ?? invoice.service_statuses ?? null

  const voided = isVoided(invoice)

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Actions bar → [status strip + editors] → printable document. The editors
          are passed as children so they sit between the actions bar and the doc
          without breaking the ActionsBar↔InvoiceDocument print-ref coupling. */}
      <InvoiceDetailClient
        invoice={invoice}
        items={items}
        products={products}
        serviceStatuses={serviceStatuses}
        currentServiceStatus={currentServiceStatus}
        stages={stages}
        workStatusConfigs={workStatusConfigs}
        customerName={customer?.clinic_name ?? null}
        totalPaid={totalPaid}
        unrecorded={unrecorded}
        billingSettings={billingSettings}
      >
        {/* Case-status strip — payment · service + money, at a glance. Work status is
            tracked per service item (see the Work Status editor below), never rolled
            up to the invoice. */}
        <Card className="print:hidden">
          <CardContent className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
            {/* Statuses */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Payment</p>
                {voided ? (
                  <StatusPill tone="danger">Voided</StatusPill>
                ) : (
                  <StatusPill tone={statusTone('payment', invoice.status)}>{paymentStatusLabel(invoice.status)}</StatusPill>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Service</p>
                {currentServiceStatus ? (
                  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', currentServiceStatus.color ?? DEFAULT_COLOR)}>
                    {currentServiceStatus.label}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>
            {/* Money — balance due is the hero; total/paid support it */}
            <div className="flex items-end justify-between gap-6 sm:gap-10 md:justify-end">
              <div className="flex gap-6 sm:gap-8">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <Money amount={Number(invoice.total)} className="mt-0.5 block text-sm font-medium" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <Money amount={totalPaid} tone={totalPaid > 0 ? 'success' : 'default'} className="mt-0.5 block text-sm font-medium" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">{outstanding > 0 ? 'Balance due' : 'Settled'}</p>
                <Money
                  amount={outstanding}
                  tone={outstanding <= 0 ? 'success' : invoice.status === 'overdue' ? 'danger' : 'warning'}
                  className="mt-0.5 block text-3xl font-semibold leading-none sm:text-4xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Daily work — above the printable document */}
        {!voided && items.length > 0 && <WorkStatusEditor items={items} history={history} stages={stages} statusConfigs={workStatusConfigs} />}
        {!voided && <CaseDetailsEditor invoice={invoice} serviceStatusId={invoice.service_status_id} serviceStatuses={serviceStatuses} />}
      </InvoiceDetailClient>

      {/* Internal remarks — staff-only, never printed. Stored in invoices.notes. */}
      {invoice.notes?.trim() && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">Remarks</CardTitle>
            <p className="text-xs text-muted-foreground">Internal only — not shown to the clinic.</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Payment history — read-only, server-rendered, hidden on print */}
      {payments.length > 0 && (
        <Card className="print:hidden">
          <CardHeader><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[42rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-sm font-mono">{p.reference_number ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.notes ?? '—'}</TableCell>
                      <TableCell className="text-right font-medium"><Money amount={Number(p.amount)} tone="success" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-semibold">Outstanding</TableCell>
                    <TableCell className="text-right font-bold"><Money amount={outstanding} tone={outstanding > 0 ? 'warning' : 'success'} /></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity timeline — who did what on this invoice. Internal, never printed. */}
      <InvoiceActivityPanel events={activity} statusConfigs={workStatusConfigs} />
    </div>
  )
}
