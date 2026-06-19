// Server-side READ query functions for the products module.
//
// Runs inside Server Components via the SSR client (`await createClient()`),
// RLS-aware through the session cookie. Mirrors the query the current client
// page runs today, so the move to server-first rendering is behaviour-preserving.
//
// Writes live in `./product-actions.ts`.

import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/lib/database.types'

// List query — mirrors `products/page.tsx`: `.select('*').order('name')`.
// Returns ALL products (active + inactive); the admin catalogue shows both,
// dimming the inactive ones. (Invoice/work reads filter to active separately.)
export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*').order('name')
  return (data ?? []) as Product[]
}
