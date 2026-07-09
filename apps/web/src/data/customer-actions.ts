'use server'

// Server Actions (WRITES) for the customers module.
//
// The customers module is served entirely by the NestJS API. Each action posts
// to an API endpoint (which enforces the customers.edit permission + validates
// with the shared customerInputSchema), then revalidates the affected Next
// paths. Signatures are unchanged so the components are untouched.

import { revalidatePath } from 'next/cache'
import { apiSend } from '@/lib/api/client'
import type { CustomerInput } from '@chidental/shared'

export type ActionResult = { ok: true } | { ok: false; error: string }
export type CreateResult = { ok: true; id: string } | { ok: false; error: string }

export async function createCustomerAction(input: CustomerInput): Promise<CreateResult> {
  const res = await apiSend<CreateResult>('POST', '/customers', input)
  if (res.ok) revalidatePath('/customers')
  return res
}

export async function updateCustomerAction(id: string, input: CustomerInput): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('PATCH', `/customers/${id}`, input)
  if (res.ok) {
    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)
  }
  return res
}

// Soft-delete: archive hides a clinic from the directory, global search, and the
// new-invoice picker, but keeps all historical invoices/statements intact.
export async function archiveCustomerAction(id: string): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('POST', `/customers/${id}/archive`)
  if (res.ok) {
    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)
  }
  return res
}

export async function restoreCustomerAction(id: string): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('POST', `/customers/${id}/restore`)
  if (res.ok) {
    revalidatePath('/customers')
    revalidatePath(`/customers/${id}`)
  }
  return res
}
