'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/feedback/toast'
import { ArchiveRestore, Trash2, RotateCcw, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { DeletedInvoiceRow, ArchivedClinicRow, AuditRow, InvoiceActivityFeedRow, InvoiceHealthRow } from '@/data/admin'
import { actionLabel } from '@/lib/audit/action-labels'
import { formatDateTime } from '@/lib/utils'
import {
  restoreInvoiceAction, purgeInvoiceAction, purgeCustomerAction,
} from '@/lib/admin/admin-actions'

type PurgeTarget =
  | { kind: 'invoice'; id: string; label: string }
  | { kind: 'clinic'; id: string; label: string; invoiceCount: number; creditCount: number }

// Spells out the cascade blast radius for a clinic purge, flowing after the clinic
// name in the confirm dialog. Returns just a period when the clinic has no records.
function describeClinicCascade(invoiceCount: number, creditCount: number): string {
  const parts: string[] = []
  if (invoiceCount > 0) parts.push(`${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} (with their line items and payments)`)
  if (creditCount > 0) parts.push(`${creditCount} credit${creditCount === 1 ? '' : 's'}`)
  return parts.length === 0 ? '.' : ` and its ${parts.join(' and ')}.`
}

export function AdminConsoleClient({
  deletedInvoices, archivedClinics, audit, invoiceActivity, healthIssues,
}: {
  deletedInvoices: DeletedInvoiceRow[]
  archivedClinics: ArchivedClinicRow[]
  audit: AuditRow[]
  invoiceActivity: InvoiceActivityFeedRow[]
  healthIssues: InvoiceHealthRow[]
}) {
  const router = useRouter()
  const { show } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [purge, setPurge] = useState<PurgeTarget | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState('')
  const [purging, setPurging] = useState(false)

  function closePurge() { setPurge(null); setConfirmText(''); setReason('') }

  async function restoreInvoice(id: string) {
    setBusyId(id)
    try {
      const res = await restoreInvoiceAction(id)
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      show({ variant: 'success', title: 'Invoice restored' })
      router.refresh()
    } finally { setBusyId(null) }
  }

  async function runPurge() {
    if (!purge) return
    setPurging(true)
    try {
      const trimmedReason = reason.trim() || undefined
      const res = purge.kind === 'invoice'
        ? await purgeInvoiceAction({ id: purge.id, reason: trimmedReason })
        : await purgeCustomerAction({ id: purge.id, reason: trimmedReason })
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      show({ variant: 'success', title: 'Permanently deleted' })
      closePurge()
      router.refresh()
    } finally { setPurging(false) }
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Admin Console</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Restore or permanently delete records, and review the audit trail. These
          actions are limited to Super Admins and are all logged.
        </p>
      </div>

      <Tabs defaultValue="recycle">
        <TabsList>
          <TabsTrigger value="recycle">Recycle Bin</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            Data Health
            {healthIssues.length > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px] leading-4">{healthIssues.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="invoice-activity">Invoice Activity</TabsTrigger>
        </TabsList>

        {/* ---- Recycle Bin ---- */}
        <TabsContent value="recycle" className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Deleted invoices</h3>
            <Card>
              <CardContent className="p-0">
                {deletedInvoices.length === 0 ? (
                  <EmptyState title="No deleted invoices" description="Invoices you delete will appear here to restore or permanently remove." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Clinic</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedInvoices.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.customers?.clinic_name ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{inv.delete_reason ?? '—'}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="outline" size="sm" disabled={busyId === inv.id} onClick={() => restoreInvoice(inv.id)}>
                              <ArchiveRestore className="h-4 w-4 mr-1.5" />Restore
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => { setPurge({ kind: 'invoice', id: inv.id, label: inv.invoice_number }); setConfirmText(''); setReason('') }}>
                              <Trash2 className="h-4 w-4 mr-1.5" />Delete permanently
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Archived clinics</h3>
            <p className="text-xs text-muted-foreground">
              Restore an archived clinic from its clinic page. Deleting one here is
              permanent and also deletes all of its invoices, line items, payments,
              and credits.
            </p>
            <Card>
              <CardContent className="p-0">
                {archivedClinics.length === 0 ? (
                  <EmptyState title="No archived clinics" description="Clinics archived from their clinic page appear here, where a Super Admin can permanently delete them." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Clinic</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedClinics.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.clinic_name}</TableCell>
                          <TableCell className="space-x-1.5">
                            {c.invoice_count === 0 && c.credit_count === 0 ? (
                              <span className="text-muted-foreground">No records</span>
                            ) : (
                              <>
                                {c.invoice_count > 0 && <Badge variant="secondary">{c.invoice_count} invoice{c.invoice_count === 1 ? '' : 's'}</Badge>}
                                {c.credit_count > 0 && <Badge variant="secondary">{c.credit_count} credit{c.credit_count === 1 ? '' : 's'}</Badge>}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="destructive" size="sm" onClick={() => { setPurge({ kind: 'clinic', id: c.id, label: c.clinic_name, invoiceCount: c.invoice_count, creditCount: c.credit_count }); setConfirmText(''); setReason('') }}>
                              <Trash2 className="h-4 w-4 mr-1.5" />Delete permanently
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        {/* ---- Data Health ---- */}
        <TabsContent value="health" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Invoices whose stored status or amounts don&apos;t line up with their recorded
            payments or line items — e.g. marked Paid without a matching payment. Open the
            invoice to correct it (record the payment, or change the status).
          </p>
          <Card>
            <CardContent className="p-0">
              {healthIssues.length === 0 ? (
                <EmptyState title="All clear" description="Every invoice's status and amounts are consistent with its recorded payments." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthIssues.map(h => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.invoice_number}</TableCell>
                        <TableCell>{h.clinic_name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{h.message}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/invoices/${h.id}`}>
                              <ExternalLink className="h-4 w-4 mr-1.5" />Open
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Activity ---- */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-0">
              {audit.length === 0 ? (
                <EmptyState title="No activity yet" description="Destructive admin actions will be recorded here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.created_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{a.action}</TableCell>
                        <TableCell>{a.entity_label ?? a.entity_type}</TableCell>
                        <TableCell className="text-muted-foreground">{a.reason ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Invoice Activity ---- */}
        <TabsContent value="invoice-activity">
          <Card>
            <CardContent className="p-0">
              {invoiceActivity.length === 0 ? (
                <EmptyState title="No invoice activity yet" description="Invoice actions (issue, payment, void, edits) will be recorded here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceActivity.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.created_at)}</TableCell>
                        <TableCell className="font-medium">{a.actor_name}</TableCell>
                        <TableCell>{actionLabel(a.action)}</TableCell>
                        <TableCell className="font-mono text-xs">{a.entity_label ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{a.reason ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Typed-confirmation purge dialog */}
      <Dialog open={purge !== null} onOpenChange={o => { if (!o) closePurge() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Permanently delete
            </DialogTitle>
          </DialogHeader>
          {purge && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                This permanently deletes <span className="font-semibold text-foreground">{purge.label}</span>
                {purge.kind === 'invoice'
                  ? ' and all of its line items and payments. '
                  : `${describeClinicCascade(purge.invoiceCount, purge.creditCount)} `}
                This cannot be undone.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Type <span className="font-mono">{purge.label}</span> to confirm</label>
                <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={purge.label} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Reason <span className="text-muted-foreground font-normal">(optional, logged)</span></label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="e.g. test data cleanup" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closePurge} disabled={purging}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={runPurge}
              disabled={purging || !purge || confirmText !== purge.label}
            >
              <RotateCcw className={purging ? 'h-4 w-4 mr-1.5 animate-spin' : 'hidden'} />
              {purging ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
