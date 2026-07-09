// Server-safe URL-driven list state: the typed shape of the parsed
// `searchParams` and the pure parser that produces it. These have NO React /
// client dependencies, so Server Components (the list pages) can import and
// call them directly. The client-only mutation hook lives in
// `./use-list-url-state` and re-exports `ListUrlState` from here.

export interface ListUrlState {
  q: string
  view: string
  page: number
  sort: string | null
  dir: 'asc' | 'desc'
}

/**
 * Parse raw Next.js `searchParams` into a typed {@link ListUrlState}. Unknown /
 * malformed values fall back to safe defaults (page 1, asc, no sort).
 */
export function parseListSearchParams(
  sp: Record<string, string | string[] | undefined>,
  defaultView: string,
): ListUrlState {
  const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))
  const pageNum = Number.parseInt(first(sp.page), 10)
  const sort = first(sp.sort) || null
  const dir = first(sp.dir) === 'desc' ? 'desc' : 'asc'
  return {
    q: first(sp.q),
    view: first(sp.view) || defaultView,
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    sort,
    dir,
  }
}
