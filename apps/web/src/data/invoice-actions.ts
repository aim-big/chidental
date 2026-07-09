'use server'

// Server Actions (WRITES) for the invoices + work modules.
//
// Both modules are served entirely by the NestJS API. Each action posts to an
// API endpoint (which enforces the permission gate, validates with the shared
// Zod schema, runs the transactional RPC / mutation, and writes the activity
// row), then revalidates the affected Next paths. Signatures are unchanged so
// the components are untouched.
//
// Void actions live in `@/lib/invoices/void-actions` — import them directly.
// (A 'use server' file may only export async functions, so we can't re-export here.)

import { revalidatePath } from 'next/cache'
import { apiSend } from '@/lib/api/client'
import type { WorkStatus } from '@chidental/shared'

export type ActionResult = { ok: true } | { ok: false; error: string }
export type CreateResult = { ok: true; id: string } | { ok: false; error: string }

// Shape the create/update form sends for the invoice header. Mirrors
// `InvoiceForm.invoicePayload()`. Status + created_by are added server-side.
export type InvoicePayload = {
  customer_id: string
  invoice_date: string
  due_date: string
  notes: string | null
  patient: string | null
  doctor: string | null
  service_status_id: string | null
  bill_to_name: string | null
  bill_to_contact: string | null
  bill_to_phone: string | null
  billing_address: string | null
  ship_to_name: string | null
  ship_to_contact: string | null
  delivery_address: string | null
  subtotal: number
  total: number
}

// Line item the create/update RPC diffs. `id` is null for new rows.
export type InvoiceItemPayload = {
  id?: string | null
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  amount: number
}

// Recipient (Bill To / Deliver To) fields written onto the invoice.
export type RecipientFields = {
  bill_to_name: string | null
  bill_to_contact: string | null
  bill_to_phone: string | null
  billing_address: string | null
  ship_to_name: string | null
  ship_to_contact: string | null
  delivery_address: string | null
}

// Revalidate both the list and the specific invoice's detail page.
function revalidateInvoice(id: string) {
  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
}

// A work write returns the affected invoice id so we can revalidate its page.
type WorkWriteResult = { ok: boolean; invoiceId?: string | null; error?: string }
async function workWrite(path: string, body?: unknown, failMsg = 'Failed'): Promise<ActionResult> {
  const res = await apiSend<WorkWriteResult>('POST', path, body)
  if (res.ok && res.invoiceId) revalidateInvoice(res.invoiceId)
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? failMsg }
}

export async function createInvoiceAction(payload: {
  p_invoice: InvoicePayload & { status: 'draft' | 'sent' }
  p_items: InvoiceItemPayload[]
}): Promise<CreateResult> {
  const res = await apiSend<CreateResult>('POST', '/invoices', payload)
  if (res.ok) revalidatePath('/invoices')
  return res
}

export async function updateInvoiceAction(
  id: string,
  payload: { p_invoice: InvoicePayload; p_items: InvoiceItemPayload[] },
): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('PATCH', `/invoices/${id}`, payload)
  if (res.ok) revalidateInvoice(id)
  return res
}

export async function recordPaymentAction(
  id: string,
  input: { amount: number; payment_date?: string; reference?: string; notes?: string },
): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('POST', `/invoices/${id}/payment`, input)
  if (res.ok) revalidateInvoice(id)
  return res
}

export async function markSentAction(id: string): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('POST', `/invoices/${id}/mark-sent`)
  if (res.ok) revalidateInvoice(id)
  return res
}

export async function updateWorkStatusAction(
  itemId: string,
  input: { work_status: WorkStatus; stage_id: string | null },
): Promise<ActionResult> {
  return workWrite(`/work/items/${itemId}/status`, input, 'Failed to update work status')
}

export async function updateWorkNoteAction(
  itemId: string,
  workNote: string | null,
): Promise<ActionResult> {
  return workWrite(`/work/items/${itemId}/note`, { workNote }, 'Failed to save note')
}

export async function updateCaseDetailsAction(
  id: string,
  input: { patient: string | null; doctor: string | null },
): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('PATCH', `/invoices/${id}/case`, input)
  if (res.ok) revalidateInvoice(id)
  return res
}

export async function updateServiceStatusAction(id: string, serviceStatusId: string | null): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('PATCH', `/invoices/${id}/service-status`, { serviceStatusId })
  if (res.ok) revalidateInvoice(id)
  return res
}

export async function saveRecipientAction(
  id: string,
  fields: RecipientFields,
  opts?: { alsoSaveToCustomer?: boolean; customerId?: string },
): Promise<ActionResult> {
  const res = await apiSend<ActionResult>('PATCH', `/invoices/${id}/recipient`, {
    fields, alsoSaveToCustomer: opts?.alsoSaveToCustomer, customerId: opts?.customerId,
  })
  if (res.ok) revalidateInvoice(id)
  return res
}
