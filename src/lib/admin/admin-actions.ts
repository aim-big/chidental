'use server'

// Server Actions for the Super Admin Console. Every action:
//   1. gates on requireSuperadmin() — the console is Super-Admin-only.
//   2. uses the service-role admin client (RLS bypassed; code-gated).
//   3. writes an admin_audit_log row (who/what/when/why) via writeAuditLog.
//   4. revalidates affected routes.
// Narrow with `gate.ok === false` (strict) per the project's strict:false rules.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperadmin } from '@/lib/auth/require-permission'
import { writeAuditLog, logInvoiceActivity } from '@/lib/audit/audit-log'
import { logServerError } from '@/lib/log'

export type ActionResult = { ok: true } | { ok: false; error: string }

function revalidateInvoiceViews(id: string) {
  revalidatePath('/invoices')
  revalidatePath(`/invoices/${id}`)
  revalidatePath('/dashboard')
  revalidatePath('/settings/admin')
}

// --- Invoices --------------------------------------------------------------

export async function softDeleteInvoiceAction(input: { id: string; reason?: string }): Promise<ActionResult> {
  const gate = await requireSuperadmin()
  if (gate.ok === false) return gate

  const admin = createAdminClient()
  const { data: inv } = await admin.from('invoices').select('invoice_number').eq('id', input.id).single()
  const { error } = await admin
    .from('invoices')
    .update({ deleted_at: new Date().toISOString(), deleted_by: gate.userId, delete_reason: input.reason?.trim() || null })
    .eq('id', input.id)
  if (error) {
    logServerError('softDeleteInvoiceAction', error, { id: input.id })
    return { ok: false, error: 'Could not delete the invoice. Please try again.' }
  }
  await writeAuditLog({
    actorId: gate.userId, action: 'invoice.soft_delete', entityType: 'invoice',
    entityId: input.id, entityLabel: inv?.invoice_number ?? null, reason: input.reason,
  })
  await logInvoiceActivity({
    invoiceId: input.id, actorId: gate.userId, actorName: gate.actorName,
    action: 'invoice.soft_deleted', entityLabel: inv?.invoice_number ?? null, reason: input.reason,
  })
  revalidateInvoiceViews(input.id)
  return { ok: true }
}

export async function restoreInvoiceAction(id: string): Promise<ActionResult> {
  const gate = await requireSuperadmin()
  if (gate.ok === false) return gate

  const admin = createAdminClient()
  const { data: inv } = await admin.from('invoices').select('invoice_number').eq('id', id).single()
  const { error } = await admin
    .from('invoices')
    .update({ deleted_at: null, deleted_by: null, delete_reason: null })
    .eq('id', id)
  if (error) {
    logServerError('restoreInvoiceAction', error, { id })
    return { ok: false, error: 'Could not restore the invoice. Please try again.' }
  }
  await writeAuditLog({
    actorId: gate.userId, action: 'invoice.restore', entityType: 'invoice',
    entityId: id, entityLabel: inv?.invoice_number ?? null,
  })
  await logInvoiceActivity({
    invoiceId: id, actorId: gate.userId, actorName: gate.actorName,
    action: 'invoice.restored', entityLabel: inv?.invoice_number ?? null,
  })
  revalidateInvoiceViews(id)
  return { ok: true }
}

// Undo a wrongful void. The prevent_invoice_restore trigger blocks clearing
// voided_at unless the app.allow_invoice_restore flag is set, which the
// admin_restore_void RPC does inside the same transaction.
export async function restoreVoidedInvoiceAction(input: { id: string; reason?: string }): Promise<ActionResult> {
  const gate = await requireSuperadmin()
  if (gate.ok === false) return gate

  const admin = createAdminClient()
  const { data: inv } = await admin.from('invoices').select('invoice_number').eq('id', input.id).single()
  const { error } = await admin.rpc('admin_restore_void', { p_id: input.id })
  if (error) {
    logServerError('restoreVoidedInvoiceAction', error, { id: input.id })
    return { ok: false, error: 'Could not restore the voided invoice. Please try again.' }
  }
  await writeAuditLog({
    actorId: gate.userId, action: 'invoice.void_restore', entityType: 'invoice',
    entityId: input.id, entityLabel: inv?.invoice_number ?? null, reason: input.reason,
  })
  await logInvoiceActivity({
    invoiceId: input.id, actorId: gate.userId, actorName: gate.actorName,
    action: 'invoice.void_restored', entityLabel: inv?.invoice_number ?? null, reason: input.reason,
  })
  revalidateInvoiceViews(input.id)
  return { ok: true }
}

// Permanent delete. invoice_items + payments cascade via ON DELETE CASCADE.
// A row snapshot is stored in the audit metadata for forensic recovery.
export async function purgeInvoiceAction(input: { id: string; reason?: string }): Promise<ActionResult> {
  const gate = await requireSuperadmin()
  if (gate.ok === false) return gate

  const admin = createAdminClient()
  const { data: inv } = await admin.from('invoices').select('*').eq('id', input.id).single()
  const { error } = await admin.from('invoices').delete().eq('id', input.id)
  if (error) {
    logServerError('purgeInvoiceAction', error, { id: input.id })
    return { ok: false, error: 'Could not permanently delete the invoice. Please try again.' }
  }
  await writeAuditLog({
    actorId: gate.userId, action: 'invoice.purge', entityType: 'invoice',
    entityId: input.id, entityLabel: inv?.invoice_number ?? null, reason: input.reason,
    metadata: (inv ?? null) as Record<string, unknown> | null,
  })
  await logInvoiceActivity({
    invoiceId: input.id, actorId: gate.userId, actorName: gate.actorName,
    action: 'invoice.purged', entityLabel: inv?.invoice_number ?? null, reason: input.reason,
    metadata: { snapshot: (inv ?? null) as Record<string, unknown> | null },
  })
  revalidateInvoiceViews(input.id)
  return { ok: true }
}

// --- Clinics (customers) ---------------------------------------------------

// Permanent cascade-delete of a clinic and everything hanging off it: its credits,
// its invoices (invoice_items + payments cascade), and the clinic row itself. All in
// one atomic transaction via the admin_purge_clinic RPC — a partial failure rolls
// back entirely. Clinics are soft-deleted via archived_at for everyday use; this is
// the Super Admin escalation (docs/CONVENTIONS.md §5). Before deleting we snapshot the
// clinic + invoice + credit rows into the audit metadata as a forensic breadcrumb
// (line items and payments are not snapshotted — same bound as the invoice purge).
export async function purgeCustomerAction(input: { id: string; reason?: string }): Promise<ActionResult> {
  const gate = await requireSuperadmin()
  if (gate.ok === false) return gate

  const admin = createAdminClient()

  // Snapshot before destroying — after the RPC these rows are gone.
  const [{ data: clinic }, { data: invoices }, { data: credits }] = await Promise.all([
    admin.from('customers').select('*').eq('id', input.id).single(),
    admin.from('invoices').select('*').eq('customer_id', input.id),
    admin.from('credits').select('*').eq('customer_id', input.id),
  ])

  const { data: counts, error } = await admin.rpc('admin_purge_clinic', { p_id: input.id })
  if (error) {
    logServerError('purgeCustomerAction', error, { id: input.id })
    return { ok: false, error: 'Could not permanently delete the clinic. Please try again.' }
  }

  await writeAuditLog({
    actorId: gate.userId, action: 'customer.purge_cascade', entityType: 'customer',
    entityId: input.id, entityLabel: clinic?.clinic_name ?? null, reason: input.reason,
    metadata: { counts, snapshot: { clinic, invoices, credits } } as Record<string, unknown>,
  })
  revalidatePath('/customers')
  revalidatePath('/settings/admin')
  return { ok: true }
}
