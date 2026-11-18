'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/feedback/toast'
import { Archive, ArchiveRestore } from 'lucide-react'
import { archiveCustomerAction, restoreCustomerAction } from '@/data/customer-actions'

// Archive = soft-delete (hide from lists/pickers, keep history). Restore = undo.
// Both gated server-side on customers.edit; this island is only rendered when the
// signed-in user holds that permission (see CustomerDetailHeader).
export function ArchiveClinicControls({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter()
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function runArchive() {
    setBusy(true)
    try {
      const res = await archiveCustomerAction(id)
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      setOpen(false)
      show({ variant: 'success', title: 'Clinic archived' })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function runRestore() {
    setBusy(true)
    try {
      const res = await restoreCustomerAction(id)
      if (res.ok === false) { show({ variant: 'error', title: res.error }); return }
      show({ variant: 'success', title: 'Clinic restored' })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (archived) {
    return (
      <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={runRestore} disabled={busy}>
        <ArchiveRestore className="h-4 w-4 mr-2" />{busy ? 'Restoring…' : 'Restore'}
      </Button>
    )
  }

  return (
    <>
      <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Archive className="h-4 w-4 mr-2" />Archive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" /> Archive Clinic
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Archive this clinic? It will be hidden from the clinic list and new invoices.
            Existing invoices and statements are kept, and you can restore it later.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={runArchive} disabled={busy}>{busy ? 'Archiving…' : 'Yes, Archive'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
