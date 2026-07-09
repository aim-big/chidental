// Server-side READ query functions for the products module.
//
// Runs inside Server Components via the SSR client (`await createClient()`),
// RLS-aware through the session cookie. Mirrors the query the current client
// page runs today, so the move to server-first rendering is behaviour-preserving.
//
// Writes live in `./product-actions.ts`.

import { createClient } from '@/lib/supabase/server'
import type { Product, Unit } from '@chidental/shared'

// List query — mirrors `products/page.tsx`: `.select('*').order('name')`.
// Returns ALL products (active + inactive); the admin catalogue shows both,
// dimming the inactive ones. (Invoice/work reads filter to active separately.)
export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').order('name')
  return (data ?? []) as Product[]
}

// --- Paginated list (URL-driven) -------------------------------------------

// The product catalogue's active/inactive filter rides the `view` URL slot.
export type ProductView = 'active' | 'inactive' | 'all'

export interface ProductListParams {
  q?: string
  view?: ProductView
  page?: number
  pageSize?: number
  sort?: string | null
  dir?: 'asc' | 'desc'
}

export interface ProductListPage {
  rows: Product[]
  total: number
  page: number
  totalPages: number
  pageStart: number
  pageEnd: number
}

// Sortable columns → DB column names. Default order is name asc.
const PRODUCT_SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  unit: 'unit',
  price: 'unit_price',
}

/**
 * URL-driven products list: server-side active filter + search + sort +
 * pagination via `.order().range()` with an exact count. Search spans
 * name / description / unit (all base-table columns), so the filter is all SQL.
 */
export async function getProductsPage(params: ProductListParams = {}): Promise<ProductListPage> {
  const { q = '', view = 'active', page = 1, pageSize = 10, sort = null, dir = 'asc' } = params
  const supabase = await createClient()

  const sortCol = (sort && PRODUCT_SORT_COLUMNS[sort]) || 'name'

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .order(sortCol, { ascending: dir !== 'desc' })

  if (view === 'active') query = query.eq('active', true)
  else if (view === 'inactive') query = query.eq('active', false)

  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%,]/g, ' ')
    query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,unit.ilike.%${safe}%`)
  }

  const safePage = Math.max(1, page)
  const from = (safePage - 1) * pageSize
  const { data, count } = await query.range(from, from + pageSize - 1)

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clamped = Math.min(safePage, totalPages)
  const rows = (data ?? []) as Product[]
  return {
    rows,
    total,
    page: clamped,
    totalPages,
    pageStart: total === 0 ? 0 : from + 1,
    pageEnd: from + rows.length,
  }
}

// Active units for the product form's unit dropdown, ordered for display.
// Inactive units are excluded; a product already using a now-inactive unit
// keeps it via the form's option-preservation (see buildUnitOptions).
export async function getActiveUnits(): Promise<Unit[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('units')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  return (data ?? []) as Unit[]
}
