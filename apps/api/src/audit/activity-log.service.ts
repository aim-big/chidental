import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

// Per-invoice activity actions — mirrors apps/web `@/lib/audit/audit-log`
// InvoiceActivityAction. These power the per-invoice timeline + the admin
// Invoice Activity view.
export type InvoiceActivityAction =
  | 'invoice.created'
  | 'invoice.issued'
  | 'invoice.edited'
  | 'invoice.recipient_changed'
  | 'invoice.case_changed'
  | 'invoice.service_status_changed'
  | 'invoice.work_note_changed'
  | 'payment.recorded'
  | 'credit.recorded'
  | 'invoice.voided'
  | 'invoice.soft_deleted'
  | 'invoice.restored'
  | 'invoice.void_restored'
  | 'invoice.purged'
  | 'payment.deleted'
  | 'credit.deleted'

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

/**
 * Best-effort per-invoice activity write — mirrors apps/web `logInvoiceActivity`
 * verbatim (same table, columns, and never-throws contract): a failed insert
 * must not abort the action it accompanies; it is logged instead.
 */
@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger('ActivityLog')

  constructor(private readonly supabase: SupabaseService) {}

  async logInvoiceActivity(entry: InvoiceActivityEntry): Promise<void> {
    try {
      const { error } = await this.supabase.admin.from('invoice_activity_log').insert({
        invoice_id: entry.invoiceId,
        actor_id: entry.actorId,
        actor_name: entry.actorName,
        action: entry.action,
        entity_label: entry.entityLabel ?? null,
        changes: (entry.changes ?? null) as never,
        reason: entry.reason ?? null,
        metadata: (entry.metadata ?? null) as never,
      })
      if (error) this.logger.error(`logInvoiceActivity(${entry.action}): ${error.message}`)
    } catch (e) {
      this.logger.error(`logInvoiceActivity(${entry.action})`, e instanceof Error ? e.stack : String(e))
    }
  }
}
