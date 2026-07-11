'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getUnits, createUnit, updateUnit, toggleUnit, moveUnit } from '@/data/settings-taxonomies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ActiveSwitch, TableActionButton } from '@/components/ui/table-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { ArrowDown, ArrowUp, PencilLine, Plus } from 'lucide-react'
import type { Unit } from '@chidental/shared'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  label: z.string().min(1, 'Label is required').max(40, 'Keep it short'),
})
type FormData = z.infer<typeof schema>

export default function UnitsPage({ initialRows }: { initialRows: Unit[] }) {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('settings.manage')
  const [rows, setRows] = useState<Unit[]>(initialRows)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { label: '' },
  })

  const load = () => getUnits().then(setRows)

  const openNew = () => {
    setEditing(null)
    setError(null)
    reset({ label: '' })
    setOpen(true)
  }

  const openEdit = (u: Unit) => {
    setEditing(u)
    setError(null)
    reset({ label: u.label })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    const res = editing
      ? await updateUnit(editing.id, data.label)
      : await createUnit(data.label)
    setSaving(false)
    if (res.ok === false) {
      setError(res.error)
    } else {
      setOpen(false)
      load()
    }
  }

  const toggleActive = async (u: Unit) => {
    await toggleUnit(u.id, !u.is_active)
    load()
  }

  const move = async (index: number, dir: -1 | 1) => {
    const current = rows[index]
    if (!current) return
    await moveUnit(current.id, dir)
    load()
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Units</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Units of measure for products (per tooth, per arch, per case…).</p>
          </div>
        </div>
        {canEdit && <Button className="w-full sm:w-auto" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Unit</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[34rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Order</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState title="No units yet" description="Add a unit of measure (per tooth, per arch, per case…) to get started." />
                  </TableCell>
                </TableRow>
              )}
              {rows.map((u, i) => (
                <TableRow key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                  <TableCell>
                    {canEdit && (
                      <div className="flex gap-1">
                        <TableActionButton label="Move up" icon={ArrowUp} disabled={i === 0} onClick={() => move(i, -1)} />
                        <TableActionButton label="Move down" icon={ArrowDown} disabled={i === rows.length - 1} onClick={() => move(i, 1)} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{u.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.is_active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <TableActionButton label="Edit unit" icon={PencilLine} tone="primary" onClick={() => openEdit(u)} />
                        <ActiveSwitch
                          checked={u.is_active}
                          onCheckedChange={() => toggleActive(u)}
                          activeLabel="Active"
                          inactiveLabel="Inactive"
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Unit' : 'New Unit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input placeholder="e.g. tooth" {...register('label')} />
              {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Unit'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
