'use server'

// Server Actions (WRITES) for the products module.
//
// Pattern (from `src/data/customer-actions.ts`):
//   1. `requirePermission('products.edit')` — server-side gate (DB is source of truth).
//   2. `if (gate.ok === false) return gate` — short-circuit with the error.
//   3. validate the clean payload with the shared `productInputSchema`.
//   4. `createAdminClient()` — service-role client; mutate the row.
//   5. `revalidatePath('/products')`.
//   6. return an `ActionResult` / `CreateResult`.
//
// PERMISSION MAPPING: all writes gate to `products.edit`, matching the UI today —
// Add/Edit/toggle affordances all render behind `hasPermission('products.edit')`.
//
// The client (`ProductsClient`) resolves its price-range toggle into a clean
// payload before calling these — when a range is used it sends min/max set and
// `unit_price = min` (mirrors the original page).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/require-permission'
import { productInputSchema, idSchema, toggleActiveInputSchema, type ProductInput } from '@chidental/shared'

export type ActionResult = { ok: true } | { ok: false; error: string }
export type CreateResult = { ok: true; id: string } | { ok: false; error: string }

function toRow(input: ProductInput) {
  return {
    name: input.name,
    description: input.description,
    unit_price: input.unit_price,
    unit: input.unit,
    min_unit_price: input.min_unit_price,
    max_unit_price: input.max_unit_price,
  }
}

export async function createProductAction(input: ProductInput): Promise<CreateResult> {
  const gate = await requirePermission('products.edit')
  if (gate.ok === false) return gate

  const parsed = productInputSchema.safeParse(input)
  if (parsed.success === false) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()
  const { data, error } = await admin.from('products').insert({ ...toRow(parsed.data), active: true }).select('id').single()
  if (error) return { ok: false, error: error.message }

  revalidatePath('/products')
  return { ok: true, id: data.id as string }
}

export async function updateProductAction(id: string, input: ProductInput): Promise<ActionResult> {
  const gate = await requirePermission('products.edit')
  if (gate.ok === false) return gate

  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid product id' }
  const parsed = productInputSchema.safeParse(input)
  if (parsed.success === false) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()
  const { error } = await admin.from('products').update(toRow(parsed.data)).eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/products')
  return { ok: true }
}

export async function toggleProductActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const gate = await requirePermission('products.edit')
  if (gate.ok === false) return gate

  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid product id' }
  if (!toggleActiveInputSchema.safeParse({ active }).success) return { ok: false, error: 'Invalid state' }

  const admin = createAdminClient()
  const { error } = await admin.from('products').update({ active }).eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/products')
  return { ok: true }
}
