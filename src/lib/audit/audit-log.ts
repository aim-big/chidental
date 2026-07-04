import { createAdminClient } from '@/lib/supabase/admin'
import { logServerError } from '@/lib/log'

export type AuditAction =
  | 'invoice.soft_delete' | 'invoice.restore' | 'invoice.purge' | 'invoice.void_restore'
  | 'customer.purge' | 'customer.purge_cascade'
  | 'payment.delete' | 'credit.delete'
  | 'product.delete' | 'employee.delete'

export interface AuditEntry {
  actorId: string
  action: AuditAction
  entityType: string
  entityId?: string | null
  entityLabel?: string | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
}

// Best-effort audit write. Never throws — a failed audit insert must not abort the
// admin action it accompanies; it is logged instead so the operation still
// succeeds and the failure is visible in server logs.
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('admin_audit_log').insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      entity_label: entry.entityLabel ?? null,
      reason: entry.reason ?? null,
      metadata: (entry.metadata ?? null) as never,
    })
    if (error) logServerError('writeAuditLog', error, { action: entry.action })
  } catch (e) {
    logServerError('writeAuditLog', e, { action: entry.action })
  }
}

// Per-invoice activity timeline actions. Distinct from AuditAction (which is the
// cross-entity Super Admin destructive log) — these power the per-invoice
// timeline and the admin Invoice Activity view, written from the invoice actions.
export type InvoiceActivityAction =
  | 'invoice.created' | 'invoice.issued' | 'invoice.edited'
  | 'invoice.recipient_changed' | 'invoice.case_changed'
  | 'invoice.service_status_changed' | 'invoice.work_note_changed'
  | 'payment.recorded' | 'credit.recorded'
  | 'invoice.voided' | 'invoice.soft_deleted' | 'invoice.restored'
  | 'invoice.void_restored' | 'invoice.purged'
  | 'payment.deleted' | 'credit.deleted'

export interface InvoiceActivityEntry {
  invoiceId: string | null
  actorId: string
  actorName: string
  action: InvoiceActivityAction
  entityLabel?: string | null
  changes?: unknown
  reason?: string | null
  metadata?: Record<string, unknown> | null
}

// Best-effort per-invoice activity write. Never throws — a failed insert must not
// abort the action it accompanies (same contract as writeAuditLog above).
export async function logInvoiceActivity(entry: InvoiceActivityEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('invoice_activity_log').insert({
      invoice_id: entry.invoiceId,
      actor_id: entry.actorId,
      actor_name: entry.actorName,
      action: entry.action,
      entity_label: entry.entityLabel ?? null,
      changes: (entry.changes ?? null) as never,
      reason: entry.reason ?? null,
      metadata: (entry.metadata ?? null) as never,
    })
    if (error) logServerError('logInvoiceActivity', error, { action: entry.action })
  } catch (e) {
    logServerError('logInvoiceActivity', e, { action: entry.action })
  }
}
