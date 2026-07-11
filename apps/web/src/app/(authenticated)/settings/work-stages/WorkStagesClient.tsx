'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getWorkStages,
  createWorkStage,
  updateWorkStage,
  toggleWorkStage,
  moveWorkStage,
} from '@/data/settings-taxonomies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActiveSwitch, TableActionButton } from '@/components/ui/table-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { ArrowDown, ArrowUp, PencilLine, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkStage } from '@chidental/shared'
import { COLOR_PRESETS, DEFAULT_COLOR } from '@/lib/service-status'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  label: z.string().min(1, 'Label is required').max(40, 'Keep it short'),
  color: z.string().min(1),
})
type FormData = z.infer<typeof schema>

export default function WorkStagesPage({ initialRows }: { initialRows: WorkStage[] }) {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('settings.manage')
  const [rows, setRows] = useState<WorkStage[]>(initialRows)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WorkStage | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', color: DEFAULT_COLOR },
  })
  const watchedColor = useWatch({ control, name: 'color' })
  const watchedLabel = useWatch({ control, name: 'label' })

  const load = () => getWorkStages().then(setRows)

  const openNew = () => {
    setEditing(null)
    setError(null)
    reset({ label: '', color: DEFAULT_COLOR })
    setOpen(true)
  }

  const openEdit = (s: WorkStage) => {
    setEditing(s)
    setError(null)
    reset({ label: s.label, color: s.color ?? DEFAULT_COLOR })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    const res = editing
      ? await updateWorkStage(editing.id, data.label, data.color)
      : await createWorkStage(data.label, data.color)
    setSaving(false)
    if (res.ok === false) {
      setError(res.error)
    } else {
      setOpen(false)
      load()
    }
  }

  const toggleActive = async (s: WorkStage) => {
    await toggleWorkStage(s.id, !s.is_active)
    load()
  }

  const move = async (index: number, dir: -1 | 1) => {
    const current = rows[index]
    if (!current) return
    await moveWorkStage(current.id, dir)
    load()
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">In-Progress Stages</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Sub-statuses of &ldquo;In Progress&rdquo;. The order here is display order only &mdash; it does not mean a case must move through them in sequence.</p>
          </div>
        </div>
        {canEdit && <Button className="w-full sm:w-auto" onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Stage</Button>}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[34rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Display order</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState title="No stages yet" description="Add a sub-status to organise cases that are in progress." />
                  </TableCell>
                </TableRow>
              )}
              {rows.map((s, i) => (
                <TableRow key={s.id} className={s.is_active ? '' : 'opacity-50'}>
                  <TableCell>
                    {canEdit && (
                      <div className="flex gap-1">
                        <TableActionButton label="Move up" icon={ArrowUp} disabled={i === 0} onClick={() => move(i, -1)} />
                        <TableActionButton label="Move down" icon={ArrowDown} disabled={i === rows.length - 1} onClick={() => move(i, 1)} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', s.color ?? DEFAULT_COLOR)}>
                      {s.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.is_active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <TableActionButton label="Edit work stage" icon={PencilLine} tone="primary" onClick={() => openEdit(s)} />
                        <ActiveSwitch
                          checked={s.is_active}
                          onCheckedChange={() => toggleActive(s)}
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
            <DialogTitle>{editing ? 'Edit Work Stage' : 'New Work Stage'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input placeholder="e.g. Try In" {...register('label')} />
              {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setValue('color', c.value, { shouldDirty: true })}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-xs font-medium border-2 transition-colors',
                      c.value,
                      watchedColor === c.value ? 'border-foreground' : 'border-transparent hover:border-border',
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1.5">Preview</p>
                <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', watchedColor)}>
                  {watchedLabel || 'Stage'}
                </span>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Stage'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
