// Server-side READ query functions for the products module.
//
// Runs inside Server Components via the SSR client (`await createClient()`),
// RLS-aware through the session cookie. Mirrors the query the current client
// page runs today, so the move to server-first rendering is behaviour-preserving.
//
// Writes live in `./product-actions.ts`.

import { createClient } from '@/lib/supabase/server'
import type { Product, Unit } from '@/lib/database.types'

// List query — mirrors `products/page.tsx`: `.select('*').order('name')`.
// Returns ALL products (active + inactive); the admin catalogue shows both,
// dimming the inactive ones. (Invoice/work reads filter to active separately.)
export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').order('name')
  return (data ?? []) as Product[]
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
