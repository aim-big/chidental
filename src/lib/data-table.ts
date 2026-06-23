// src/lib/data-table.ts
import type { ReactNode } from 'react'

export type Align = 'left' | 'right' | 'center'

export interface Column<T> {
  /** Stable key for React + column identity. */
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: Align
  /** Extra classes for the body cell. */
  className?: string
  /** Extra classes for the header cell. */
  headClassName?: string
  /** Tailwind width class for the column, e.g. 'w-24'. */
  width?: string
  /**
   * Sort key written to the URL `sort` param when the header is clicked. When
   * set, the header becomes a sort toggle (see DataTable `sort`/`onSort`). Omit
   * for non-sortable columns (the default).
   */
  sortKey?: string
}

/** Active sort: which column key and which direction. */
export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export function alignClass(align: Align = 'left'): 'text-left' | 'text-right' | 'text-center' {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}
