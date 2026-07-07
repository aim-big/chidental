'use client'

// IMPECCABLE REDESIGN DEMO — Work. Lab production queue: every invoice line item
// tracked through stages. Board (kanban) + List views, stage filter, search.
// Mock data; drag-drop is not wired (static preview).

import { useMemo, useState } from 'react'
import { Calendar, Clock, AlertTriangle } from 'lucide-react'
import { PageHeader, Panel, SearchInput, Segmented, StatusPill, EmptyState } from '../_components/kit'
import { WORK_ITEMS, WORK_STAGES, shortDate, type WorkItem, type WorkStage } from '../_lib/mock'

type ViewMode = 'board' | 'list'
type StageFilter = 'active' | 'all' | WorkStage

export default function DemoWork() {
  const [mode, setMode] = useState<ViewMode>('board')
  const [filter, setFilter] = useState<StageFilter>('active')
  const [q, setQ] = useState('')
  const [showDelivered, setShowDelivered] = useState(false)

  const items = useMemo(() => {
    const term = q.trim().toLowerCase()
    return WORK_ITEMS.filter((w) => {
      if (filter === 'active' && w.stage === 'delivered') return false
      else if (filter !== 'active' && filter !== 'all' && w.stage !== filter) return false
      if (!term) return true
      return [w.caseRef, w.invoiceNo, w.clinic, w.patient, w.service].some((f) => f.toLowerCase().includes(term))
    })
  }, [filter, q])

  const total = items.length
  const columns = WORK_STAGES.filter((s) => (s.key === 'delivered' ? showDelivered : true))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work"
        subtitle={`${total} items across all invoices`}
        actions={
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as ViewMode)}
            options={[
              { value: 'board', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput value={q} onChange={setQ} placeholder="Search case, invoice, clinic…" className="lg:max-w-xs" />
        <div className="flex flex-wrap items-center gap-2">
          {([
            { value: 'active', label: 'Active' },
            { value: 'all', label: 'All' },
            ...WORK_STAGES.filter((s) => s.key !== 'delivered').map((s) => ({ value: s.key, label: s.label })),
          ] as { value: StageFilter; label: string }[]).map((o) => {
            const active = o.value === filter
            return (
              <button
                key={o.value}
                onClick={() => setFilter(o.value)}
                className={
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                  (active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')
                }
              >
                {o.label}
              </button>
            )
          })}
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} className="h-3.5 w-3.5 rounded border-input" />
            Show delivered
          </label>
        </div>
      </div>

      {total === 0 ? (
        <Panel className="p-16"><EmptyState icon={<Calendar className="h-5 w-5" />} title="No work items" hint="Try a different stage or search." /></Panel>
      ) : mode === 'board' ? (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {columns.map((s) => {
            const colItems = items.filter((w) => w.stage === s.key)
            return (
              <div key={s.key} className="flex w-[290px] shrink-0 flex-col">
                <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-border bg-card px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                    {s.label}
                  </span>
                  <span className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">{colItems.length}</span>
                </div>
                <div className="flex-1 space-y-2.5 rounded-b-xl border border-border bg-muted/30 p-2.5">
                  {colItems.length === 0
                    ? <p className="px-1 py-6 text-center text-xs text-muted-foreground">No items</p>
                    : colItems.map((w) => <WorkCard key={w.id} item={w} />)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {columns.map((s) => {
            const groupItems = items.filter((w) => w.stage === s.key)
            if (groupItems.length === 0) return null
            return (
              <Panel key={s.key} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">{groupItems.length}</span>
                </div>
                <ul className="divide-y divide-border/70">
                  {groupItems.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{w.caseRef}</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{w.service}</span>
                        <span className="block truncate text-xs text-muted-foreground">{w.clinic} · {w.patient}</span>
                      </span>
                      {w.subStage && <StatusPill tone="warning">{w.subStage}</StatusPill>}
                      <span className="text-xs text-muted-foreground">Shade {w.shade}</span>
                      <DueLabel item={w} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WorkCard({ item }: { item: WorkItem }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">{item.caseRef}</span>
        <DueLabel item={item} />
      </div>
      <p className="mt-1.5 text-sm font-medium text-foreground">{item.service}</p>
      <p className="truncate text-xs text-muted-foreground">{item.clinic} · {item.patient}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        {item.subStage && <StatusPill tone="warning">{item.subStage}</StatusPill>}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Shade {item.shade}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{item.updatedAgo}</span>
      </div>
    </div>
  )
}

function DueLabel({ item }: { item: WorkItem }) {
  return item.overdue ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
      <AlertTriangle className="h-3.5 w-3.5" /> Due {shortDate(item.due)}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Due {shortDate(item.due)}</span>
  )
}
