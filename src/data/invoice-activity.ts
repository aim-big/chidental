import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/require-permission'

export interface TimelineEvent {
  id: string
  at: string
  actorName: string
  action: string
  entityLabel?: string | null
  changes?: { field: string; label: string; from: unknown; to: unknown }[] | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
}

type ActivityRow = {
  id: string; created_at: string; actor_name: string; action: string
  entity_label: string | null; changes: unknown; reason: string | null
  metadata: Record<string, unknown> | null
}
type HistoryRow = {
  id: string; changed_at: string; changed_by_name: string | null
  status: string; stage_id: string | null
  invoice_items: { invoice_id: string; description: string | null } | null
}

// Per-invoice timeline: explicit activity-log events + work-status changes from the
// existing trigger table (no invoice_id there — filter via invoice_items). Gated by
// invoices.view; reads via the admin client (the page is already gated, RLS has no
// client policy). Merge + sort in TypeScript.
export async function getInvoiceActivity(invoiceId: string): Promise<TimelineEvent[]> {
  const gate = await requirePermission('invoices.view')
  if (!gate.ok) return []
  const admin = createAdminClient()

  const { data: activity } = await admin
    .from('invoice_activity_log')
    .select('id, created_at, actor_name, action, entity_label, changes, reason, metadata')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })

  const { data: history } = await admin
    .from('invoice_item_status_history')
    .select('id, changed_at, changed_by_name, status, stage_id, invoice_items!inner(invoice_id, description)')
    .eq('invoice_items.invoice_id', invoiceId)
    .order('changed_at', { ascending: false })

  const fromActivity: TimelineEvent[] = ((activity ?? []) as ActivityRow[]).map(r => ({
    id: r.id, at: r.created_at, actorName: r.actor_name, action: r.action,
    entityLabel: r.entity_label,
    changes: (r.changes ?? null) as TimelineEvent['changes'],
    reason: r.reason, metadata: r.metadata,
  }))

  const fromHistory: TimelineEvent[] = ((history ?? []) as unknown as HistoryRow[]).map(r => ({
    id: `ws-${r.id}`, at: r.changed_at, actorName: r.changed_by_name ?? '(unknown)',
    action: 'work_status.changed', entityLabel: null,
    metadata: { status: r.status, stage_id: r.stage_id, item: r.invoice_items?.description ?? null },
  }))

  return [...fromActivity, ...fromHistory].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}
