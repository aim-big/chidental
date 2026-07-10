// Server-side READ query functions for the products module.
//
// The products module is served entirely by the NestJS API. Each function is a
// thin, typed proxy over an API endpoint; the signatures are unchanged so the
// components that call them are untouched.
//
// Writes live in `./product-actions.ts`.

import { apiGet, apiGetCached } from '@/lib/api/client'
import type { Product, Unit } from '@chidental/shared'

// List query: ALL products (active + inactive), name asc — the admin catalogue
// shows both, dimming the inactive ones.
export async function getProducts(): Promise<Product[]> {
  return apiGet<Product[]>('/products')
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

/** URL-driven products list: server-side view filter + search + sort + pagination. */
export async function getProductsPage(params: ProductListParams = {}): Promise<ProductListPage> {
  const { q = '', view = 'active', page = 1, pageSize = 10, sort = null, dir = 'asc' } = params
  const qs = new URLSearchParams({ q, view, page: String(page), pageSize: String(pageSize), dir })
  if (sort) qs.set('sort', sort)
  return apiGet<ProductListPage>(`/products/page?${qs.toString()}`)
}

// Active units for the product form's unit dropdown, ordered for display.
// Global reference data — briefly cached to avoid a Railway round-trip per render.
export async function getActiveUnits(): Promise<Unit[]> {
  return apiGetCached<Unit[]>('/products/units')
}
