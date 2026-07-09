'use client'

// Thin client wrapper for the Work page that owns the List/Board toggle.
// Receives the same rows/stages from the server component; no fetching here.

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { KanbanBoard } from '@/components/work/KanbanBoard'
import { WorkQueueClient } from '@/components/work/WorkQueueClient'
import type { WorkStage, WorkStatusConfig } from '@chidental/shared'
import type { WorkQueueRow } from '@/data/work'

type ViewMode = 'board' | 'list'

const VIEW_STORAGE_KEY = 'work-view'

export function WorkViewToggle({
  rows,
  stages,
  statusConfigs,
}: {
  rows: WorkQueueRow[]
  stages: WorkStage[]
  statusConfigs: WorkStatusConfig[]
}) {
  const [view, setView] = useState<ViewMode>('list')

  // Remember the chosen view across visits. Read in an effect (not the state
  // initializer) so server + first client render agree and hydration stays clean.
  useEffect(() => {
    if (localStorage.getItem(VIEW_STORAGE_KEY) === 'board') setView('board')
  }, [])
  const pickView = (v: ViewMode) => {
    setView(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  return (
    <div className="space-y-6">
      {/* Page header + view toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Work</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} item{rows.length === 1 ? '' : 's'} across all invoices
          </p>
        </div>

        {/* List | Board toggle */}
        <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 text-sm sm:flex sm:w-auto sm:items-center">
          <ToggleButton
            active={view === 'list'}
            onClick={() => pickView('list')}
            label="List"
          />
          <ToggleButton
            active={view === 'board'}
            onClick={() => pickView('board')}
            label="Board"
          />
        </div>
      </div>

      {/* View */}
      {view === 'board' ? (
        <KanbanBoard rows={rows} stages={stages} statusConfigs={statusConfigs} />
      ) : (
        <WorkQueueClient rows={rows} stages={stages} statusConfigs={statusConfigs} hideHeader />
      )}
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-3 py-1.5 font-medium transition-colors',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
