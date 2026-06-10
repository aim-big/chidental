'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/require-permission'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function voidInvoice(input: { id: string; reason?: string }): Promise<ActionResult> {
  const gate = await requirePermission('voidInvoice')
  if (!gate.ok) return gate

  const admin = createAdminClient()
  const { error } = await admin
    .from('invoices')
    .update({
      voided_at: new Date().toISOString(),
      voided_by: gate.userId,
      void_reason: input.reason?.trim() || null,
    })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/invoices/${input.id}`)
  revalidatePath('/invoices')
  return { ok: true }
}

export async function restoreInvoice(input: { id: string }): Promise<ActionResult> {
  const gate = await requirePermission('voidInvoice')
  if (!gate.ok) return gate

  const admin = createAdminClient()
  const { error } = await admin
    .from('invoices')
    .update({ voided_at: null, voided_by: null, void_reason: null })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/invoices/${input.id}`)
  revalidatePath('/invoices')
  return { ok: true }
}
