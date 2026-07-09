'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterChip {
  /** Stable key for React. */
  key: string
  /** e.g. "View: Overdue" or "Search: foo". */
  label: string
  /** Clears just this slice of the URL list state. */
  onRemove: () => void
}

/**
 * Removable filter chips shown above a list when a view and/or search narrows
 * it. Each chip clears its own part of the URL state (see useListUrlState).
 * Renders nothing when there are no active filters.
 */
export function FilterChips({ chips, className }: { chips: FilterChip[]; className?: string }) {
  if (chips.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map(chip => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 py-1 pl-2.5 pr-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
    </div>
  )
}
