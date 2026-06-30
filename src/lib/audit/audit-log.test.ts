import { describe, it, expect, vi } from 'vitest'

const insert = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}))

import { writeAuditLog, logInvoiceActivity } from './audit-log'

describe('writeAuditLog', () => {
  it('inserts a normalized audit row', async () => {
    await writeAuditLog({
      actorId: 'u1', action: 'invoice.purge', entityType: 'invoice',
      entityId: 'i1', entityLabel: 'INV-1042', reason: 'duplicate',
      metadata: { total: 50 },
    })
    expect(insert).toHaveBeenCalledWith({
      actor_id: 'u1', action: 'invoice.purge', entity_type: 'invoice',
      entity_id: 'i1', entity_label: 'INV-1042', reason: 'duplicate',
      metadata: { total: 50 },
    })
  })

  it('defaults optional fields to null', async () => {
    insert.mockClear()
    await writeAuditLog({ actorId: 'u2', action: 'invoice.restore', entityType: 'invoice' })
    expect(insert).toHaveBeenCalledWith({
      actor_id: 'u2', action: 'invoice.restore', entity_type: 'invoice',
      entity_id: null, entity_label: null, reason: null, metadata: null,
    })
  })

  it('never throws when the insert errors', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'boom' } })
    await expect(writeAuditLog({ actorId: 'u3', action: 'credit.delete', entityType: 'credit' })).resolves.toBeUndefined()
  })
})

describe('logInvoiceActivity', () => {
  it('inserts a normalized invoice activity row', async () => {
    insert.mockClear()
    await logInvoiceActivity({
      invoiceId: 'i1', actorId: 'u1', actorName: 'Alice Tan',
      action: 'payment.recorded', entityLabel: 'INV-1042',
      metadata: { amount: 200 },
    })
    expect(insert).toHaveBeenCalledWith({
      invoice_id: 'i1', actor_id: 'u1', actor_name: 'Alice Tan',
      action: 'payment.recorded', entity_label: 'INV-1042',
      changes: null, reason: null, metadata: { amount: 200 },
    })
  })

  it('defaults optional fields to null', async () => {
    insert.mockClear()
    await logInvoiceActivity({ invoiceId: 'i2', actorId: 'u2', actorName: 'Bob', action: 'invoice.issued' })
    expect(insert).toHaveBeenCalledWith({
      invoice_id: 'i2', actor_id: 'u2', actor_name: 'Bob', action: 'invoice.issued',
      entity_label: null, changes: null, reason: null, metadata: null,
    })
  })

  it('never throws when the insert errors', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'boom' } })
    await expect(
      logInvoiceActivity({ invoiceId: 'i3', actorId: 'u3', actorName: 'C', action: 'invoice.voided' }),
    ).resolves.toBeUndefined()
  })
})
