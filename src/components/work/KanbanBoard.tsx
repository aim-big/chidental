'use client'

// Kanban board for the Work page. Each card represents a CASE (invoice);
// dragging a card to a column advances ALL its line items to that work status.
//
// Grouping: rows are grouped by invoices.id into cases. The column a case
// appears in is determined by dominantWorkStatus(item work_statuses).
//
// DnD: native HTML5 drag-and-drop. onDragStart stashes invoiceId in
// dataTransfer; column drop handlers read it and call updateCaseWorkStatusAction.
//
// Optimistic UX: useOptimistic moves the case column immediately on drop; on
// action failure the state reverts and a toast appears. router.refresh() syncs
// the server state after either outcome.

import { useMemo, useOptimistic, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/feedback/toast'
import { cn } from '@/lib/utils'
import { todayISODate } from '@/lib/utils'
import { WORK_STATUSES, WORK_STATUS_LABELS, WORK_STATUS_COLORS, dominantWorkStatus } from '@/lib/work-status'
import { updateCaseWorkStatusAction } from '@/data/invoice-actions'
import type { WorkStatus } from '@/lib/database.types'
import type { WorkQueueRow } from '@/data/work'

// ─── Case grouping ──────────────────────────────────────────────────────────

type KanbanCase = {
  invoiceId: string
  invoiceNumber: string
  clinicName: string
  patient: string | null
  dueDate: string
  items: WorkQueueRow[]
  dominant: WorkStatus
}

function groupIntoCases(rows: WorkQueueRow[]): KanbanCase[] {
  const map = new Map<string, KanbanCase>()
  for (const row of rows) {
    if (!row.invoices) continue
    const { id: invoiceId, invoice_number, patient, due_date } = row.invoices
    const clinicName = row.invoices.customers?.clinic_name ?? '—'
    if (!map.has(invoiceId)) {
      map.set(invoiceId, {
        invoiceId,
        invoiceNumber: invoice_number,
        clinicName,
        patient: patient ?? null,
        dueDate: due_date,
        items: [],
        dominant: 'received', // placeholder, computed below
      })
    }
    map.get(invoiceId)!.items.push(row)
  }

  // Compute dominant status now that all items are grouped.
  const cases: KanbanCase[] = []
  for (const c of map.values()) {
    const dominant = dominantWorkStatus(c.items.map(i => i.work_status))
    if (dominant !== null) {
      cases.push({ ...c, dominant })
    }
  }
  return cases
}

// ─── Optimistic state ───────────────────────────────────────────────────────

type OptimisticCaseMove = { invoiceId: string; dominant: WorkStatus }

function applyOptimisticMove(cases: KanbanCase[], move: OptimisticCaseMove): KanbanCase[] {
  return cases.map(c =>
    c.invoiceId === move.invoiceId
      ? { ...c, dominant: move.dominant, items: c.items.map(i => ({ ...i, work_status: move.dominant })) }
      : c,
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function CaseCard({
  kase,
  today,
  onDragStart,
  onClick,
}: {
  kase: KanbanCase
  today: string
  onDragStart: (e: React.DragEvent, invoiceId: string) => void
  onClick: (invoiceId: string) => void
}) {
  const isPastDue = kase.dueDate < today && kase.dominant !== 'delivered'

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, kase.invoiceId)}
      onClick={() => onClick(kase.invoiceId)}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-md transition-shadow select-none',
      )}
    >
      {/* Clinic name */}
      <div className="font-semibold text-foreground text-sm leading-snug truncate">
        {kase.clinicName}
      </div>

      {/* Patient */}
      {kase.patient && (
        <div className="text-xs text-muted-foreground mt-0.5 truncate">{kase.patient}</div>
      )}

      {/* Invoice # + item count */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-mono text-muted-foreground">{kase.invoiceNumber}</span>
        <span className="text-xs text-muted-foreground">
          {kase.items.length} item{kase.items.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Due date */}
      <div className={cn('text-xs mt-1', isPastDue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
        Due {kase.dueDate}
        {isPastDue && ' · overdue'}
      </div>
    </div>
  )
}

function KanbanColumn({
  status,
  cases,
  today,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  status: WorkStatus
  cases: KanbanCase[]
  today: string
  onDragStart: (e: React.DragEvent, invoiceId: string) => void
  onDrop: (e: React.DragEvent, targetStatus: WorkStatus) => void
  onCardClick: (invoiceId: string) => void
}) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div
      className="flex flex-col w-72 shrink-0"
      onDragOver={handleDragOver}
      onDrop={e => onDrop(e, status)}
    >
      {/* Column header */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0 border-border',
        'bg-muted/50',
      )}>
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
          WORK_STATUS_COLORS[status],
        )}>
          {WORK_STATUS_LABELS[status]}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">{cases.length}</span>
      </div>

      {/* Cards area — scrolls vertically if many cards */}
      <div
        className={cn(
          'flex-1 min-h-32 flex flex-col gap-2 p-2',
          'rounded-b-lg border border-border bg-muted/20',
        )}
      >
        {cases.map(c => (
          <CaseCard
            key={c.invoiceId}
            kase={c}
            today={today}
            onDragStart={onDragStart}
            onClick={onCardClick}
          />
        ))}
        {cases.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-6">
            No cases
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function KanbanBoard({ rows }: { rows: WorkQueueRow[] }) {
  const router = useRouter()
  const { show } = useToast()
  const [, startTransition] = useTransition()

  const today = todayISODate()

  const baseCases = useMemo(() => groupIntoCases(rows), [rows])

  const [optimisticCases, applyOptimistic] = useOptimistic(
    baseCases,
    applyOptimisticMove,
  )

  // Group cases into columns by dominant status.
  const casesByStatus = useMemo(() => {
    const map = new Map<WorkStatus, KanbanCase[]>()
    for (const s of WORK_STATUSES) map.set(s, [])
    for (const c of optimisticCases) {
      map.get(c.dominant)!.push(c)
    }
    return map
  }, [optimisticCases])

  const handleDragStart = (e: React.DragEvent, invoiceId: string) => {
    e.dataTransfer.setData('text/plain', invoiceId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetStatus: WorkStatus) => {
    e.preventDefault()
    const invoiceId = e.dataTransfer.getData('text/plain')
    if (!invoiceId) return

    const kase = optimisticCases.find(c => c.invoiceId === invoiceId)
    if (!kase || kase.dominant === targetStatus) return

    startTransition(async () => {
      applyOptimistic({ invoiceId, dominant: targetStatus })
      const res = await updateCaseWorkStatusAction(invoiceId, targetStatus)
      if (res.ok === false) {
        show({ variant: 'error', title: res.error })
      }
      router.refresh()
    })
  }

  const handleCardClick = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}`)
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {WORK_STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            cases={casesByStatus.get(status) ?? []}
            today={today}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onCardClick={handleCardClick}
          />
        ))}
      </div>
    </div>
  )
}
