// src/lib/list-view-state.ts
export type ListViewState = 'loading' | 'empty-first-run' | 'empty-no-results' | 'rows'

export function listViewState(args: {
  loading: boolean
  total: number
  filtered: number
  hasQuery: boolean
}): ListViewState {
  if (args.loading) return 'loading'
  if (args.total === 0) return 'empty-first-run'
  if (args.filtered === 0 && args.hasQuery) return 'empty-no-results'
  return 'rows'
}
