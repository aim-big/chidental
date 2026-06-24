'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/feedback/toast'
import { ArchiveRestore, Trash2, RotateCcw } from 'lucide-react'
import type { DeletedInvoiceRow, ArchivedClinicRow, AuditRow } from '@/data/admin'
import {
  restoreInvoiceAction, purgeInvoiceAction, purgeCustomerAction,
} from '@/lib/admin/admin-actions'

type PurgeTarget =
  | { kind: 'invoice'; id: string; label: string }
  | { kind: 'clinic'; id: string; label: string }

export function AdminConsoleClient({
  deletedInvoices, archivedClinics, audit,
}: {
  deletedInvoices: DeletedInvoiceRow[]
  archivedClinics: ArchivedClinicRow[]
  audit: AuditRow[]
}) {
  const router = useRouter()
  const { show } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [purge, setPurge] = useState<PurgeTarget | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [purging, setPurging] = useState(false)

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
      const res = purge.kind === 'invoice'
        ? await purgeInvoiceAction({ id: purge.id })
        : await purgeCustomerAction({ id: purge.id })
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      show({ variant: 'success', title: 'Permanently deleted' })
      setPurge(null); setConfirmText('')
      router.refresh()
    } finally { setPurging(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Admin Console</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Restore or permanently delete records, and review the audit trail. These
          actions are limited to Super Admins and are all logged.
        </p>
      </div>

      <Tabs defaultValue="recycle">
        <TabsList>
          <TabsTrigger value="recycle">Recycle Bin</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
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
                            <Button variant="destructive" size="sm" onClick={() => { setPurge({ kind: 'invoice', id: inv.id, label: inv.invoice_number }); setConfirmText('') }}>
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
              Restore an archived clinic from its clinic page. Permanent deletion here
              is only possible once a clinic has no invoices or credits left.
            </p>
            <Card>
              <CardContent className="p-0">
                {archivedClinics.length === 0 ? (
                  <EmptyState title="No archived clinics" description="Archived clinics can be permanently removed here when they have no records." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Clinic</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedClinics.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.clinic_name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="destructive" size="sm" onClick={() => { setPurge({ kind: 'clinic', id: c.id, label: c.clinic_name }); setConfirmText('') }}>
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
                        <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
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
      </Tabs>

      {/* Typed-confirmation purge dialog */}
      <Dialog open={purge !== null} onOpenChange={o => { if (!o) { setPurge(null); setConfirmText('') } }}>
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
                {purge.kind === 'invoice' ? ' and all of its line items and payments. ' : '. '}
                This cannot be undone.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Type <span className="font-mono">{purge.label}</span> to confirm</label>
                <Input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={purge.label} autoFocus />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPurge(null); setConfirmText('') }} disabled={purging}>Cancel</Button>
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
