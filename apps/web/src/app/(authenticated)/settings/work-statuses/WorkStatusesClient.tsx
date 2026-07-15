'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PencilLine } from 'lucide-react'
import { getWorkStatusConfigs, updateWorkStatusConfig } from '@/data/settings-taxonomies'
import type { Tables } from '@chidental/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableActionButton } from '@/components/ui/table-actions'
import { cn } from '@/lib/utils'
import { COLOR_PRESETS } from '@/lib/service-status'
import { DEFAULT_WORK_STATUS_CONFIGS, workStatusDisplays, type WorkStatusDisplay } from '@/lib/work-status-config'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  label: z.string().min(1, 'Label is required').max(40, 'Keep it short'),
  color: z.string().min(1),
})
type FormData = z.infer<typeof schema>

export default function WorkStatusesPage({ initialRows }: { initialRows: Tables<'work_status_configs'>[] }) {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('settings.manage')
  const [rows, setRows] = useState<WorkStatusDisplay[]>(
    initialRows.length ? workStatusDisplays(initialRows) : DEFAULT_WORK_STATUS_CONFIGS,
  )
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WorkStatusDisplay | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', color: DEFAULT_WORK_STATUS_CONFIGS[0].color ?? '' },
  })
  const watchedColor = useWatch({ control, name: 'color' })
  const watchedLabel = useWatch({ control, name: 'label' })

  const load = () => getWorkStatusConfigs().then(data => setRows(workStatusDisplays(data)))

  const openEdit = (row: WorkStatusDisplay) => {
    setEditing(row)
    setError(null)
    reset({ label: row.label, color: row.color ?? DEFAULT_WORK_STATUS_CONFIGS[0].color ?? '' })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    if (!canEdit || !editing) return
    setSaving(true)
    setError(null)
    const res = await updateWorkStatusConfig(editing.status, data.label, data.color)
    setSaving(false)
    if (res.ok === false) {
      setError(res.error)
      return
    }
    setOpen(false)
    load()
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Work Statuses</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Labels and colors for the fixed production flow.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[32rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">System key</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.status}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.status}</TableCell>
                  <TableCell>
                    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', row.color)}>
                      {row.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <TableActionButton label="Edit work status" icon={PencilLine} tone="primary" onClick={() => openEdit(row)} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent description="Edit this work status's label and appearance.">
          <DialogHeader>
            <DialogTitle>Edit Work Status</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>System key</Label>
              <Input value={editing?.status ?? ''} disabled className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input placeholder="e.g. Ready for Delivery" {...register('label')} />
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
                  {watchedLabel || 'Status'}
                </span>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
