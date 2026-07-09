'use server'

// Server Actions (WRITES) for the customers module.
//
// Pattern (from `src/data/invoice-actions.ts`):
//   1. `requirePermission('customers.edit')` — server-side gate (DB is source of truth).
//   2. `if (!gate.ok) return gate` — short-circuits with the ActionResult error.
//   3. validate the input with the shared `customerInputSchema`.
//   4. `createAdminClient()` — service-role client; mutate the row.
//   5. `revalidatePath('/customers')` (+ the detail path on update).
//   6. return an `ActionResult` / `CreateResult`.
//
// PERMISSION MAPPING: both writes gate to `customers.edit`, matching today's UI —
// the New/Edit affordances and the form's deep-link guard all use
// `hasPermission('customers.edit')` (customers/page.tsx, [id]/page.tsx, CustomerForm).

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/require-permission'
import { customerInputSchema, idSchema, type CustomerInput } from '@chidental/shared'

export type ActionResult = { ok: true } | { ok: false; error: string }
export type CreateResult = { ok: true; id: string } | { ok: false; error: string }

// Map validated input to the DB row. Empty strings collapse to null so optional
// columns stay clean — mirrors the old CustomerForm payload coercion.
function toRow(input: CustomerInput) {
  return {
    clinic_name: input.clinic_name,
    ssm_no: input.ssm_no || null,
    contact_person: input.contact_person || null,
    phone: input.phone || null,
    email: input.email || null,
    billing_address: input.billing_address || null,
    delivery_address: input.delivery_address || null,
    notes: input.notes || null,
  }
}

export async function createCustomerAction(input: CustomerInput): Promise<CreateResult> {
  const gate = await requirePermission('customers.edit')
  if (gate.ok === false) return gate

  const parsed = customerInputSchema.safeParse(input)
  if (parsed.success === false) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()
  const { data, error } = await admin.from('customers').insert(toRow(parsed.data)).select('id').single()
  if (error) return { ok: false, error: error.message }

  revalidatePath('/customers')
  return { ok: true, id: data.id as string }
}

export async function updateCustomerAction(id: string, input: CustomerInput): Promise<ActionResult> {
  const gate = await requirePermission('customers.edit')
  if (gate.ok === false) return gate

  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid clinic id' }
  const parsed = customerInputSchema.safeParse(input)
  if (parsed.success === false) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createAdminClient()
  const { error } = await admin.from('customers').update(toRow(parsed.data)).eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { ok: true }
}

// Soft-delete: archive hides a clinic from the directory, global search, and the
// new-invoice picker, but keeps all historical invoices/statements intact. Gated
// on customers.edit (same as create/update) — no separate delete permission.
export async function archiveCustomerAction(id: string): Promise<ActionResult> {
  const gate = await requirePermission('customers.edit')
  if (gate.ok === false) return gate

  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid clinic id' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('customers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { ok: true }
}

export async function restoreCustomerAction(id: string): Promise<ActionResult> {
  const gate = await requirePermission('customers.edit')
  if (gate.ok === false) return gate

  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid clinic id' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('customers')
    .update({ archived_at: null })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { ok: true }
}
