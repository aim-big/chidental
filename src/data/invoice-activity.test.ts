import { describe, it, expect, vi } from 'vitest'

const activityRows = [
  { id: 'a1', created_at: '2026-06-30T10:00:00Z', actor_name: 'Alice', action: 'invoice.issued', entity_label: 'INV-1', changes: null, reason: null, metadata: null },
]
const historyRows = [
  { id: 'h1', changed_at: '2026-06-30T11:00:00Z', changed_by_name: 'Bob', status: 'in_progress', stage_id: null, invoice_items: { invoice_id: 'inv-1', description: 'Crown' } },
]

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: async () => ({ ok: true, userId: 'u1', actorName: 'Alice' }),
}))

// Two sequential .from() calls: first the activity log, then the status history.
vi.mock('@/lib/supabase/admin', () => {
  const builder = (rows: unknown[]) => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.order = () => Promise.resolve({ data: rows })
    return b
  }
  let call = 0
  return { createAdminClient: () => ({ from: () => (call++ === 0 ? builder(activityRows) : builder(historyRows)) }) }
})

import { getInvoiceActivity } from './invoice-activity'

describe('getInvoiceActivity', () => {
  it('merges both sources newest-first and normalizes shapes', async () => {
    const out = await getInvoiceActivity('inv-1')
    expect(out.map(e => e.action)).toEqual(['work_status.changed', 'invoice.issued'])
    expect(out[0]).toMatchObject({ actorName: 'Bob', action: 'work_status.changed' })
    expect(out[1]).toMatchObject({ actorName: 'Alice', action: 'invoice.issued', entityLabel: 'INV-1' })
  })
})
