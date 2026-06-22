// Integration tests for the atomic payment RPCs
// (supabase/migrations/20260618010200_payment_rpcs.sql).
//
// These run real SQL against the local Supabase Postgres. See ./db.ts for setup.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import {
  connect,
  disconnect,
  begin,
  rollback,
  sql,
  asServiceRole,
  seedUser,
  seedCustomer,
  seedInvoice,
} from './db'

beforeAll(connect)
afterAll(disconnect)
beforeEach(begin)
afterEach(rollback)

/** Arrange an actor + customer + a `sent` invoice of `total`. */
async function arrangeInvoice(total: number, status = 'sent') {
  const actor = await seedUser([], { isSystem: true })
  const customerId = await seedCustomer()
  const invoiceId = await seedInvoice({ customerId, createdBy: actor, total, status })
  return { actor, invoiceId }
}

const statusOf = async (invoiceId: string) =>
  (await sql<{ status: string }>('select status from invoices where id = $1', [invoiceId])).rows[0].status

const paymentsFor = async (invoiceId: string) =>
  (await sql<{ amount: string }>('select amount from payments where invoice_id = $1', [invoiceId])).rows

describe('record_payment', () => {
  it('a partial payment returns "partial" and advances the invoice', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100)

    const res = await asServiceRole<{ record_payment: string }>(
      'select record_payment($1, $2, $3) as record_payment',
      [invoiceId, 60, actor],
    )

    expect(res.rows[0].record_payment).toBe('partial')
    expect(await statusOf(invoiceId)).toBe('partial')
    expect(await paymentsFor(invoiceId)).toHaveLength(1)
  })

  it('paying the full total returns "paid"', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100)

    const res = await asServiceRole<{ record_payment: string }>(
      'select record_payment($1, $2, $3) as record_payment',
      [invoiceId, 100, actor],
    )

    expect(res.rows[0].record_payment).toBe('paid')
    expect(await statusOf(invoiceId)).toBe('paid')
  })

  it('successive payments reaching the total flip partial -> paid', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100)

    const first = await asServiceRole<{ record_payment: string }>(
      'select record_payment($1, $2, $3) as record_payment', [invoiceId, 60, actor],
    )
    const second = await asServiceRole<{ record_payment: string }>(
      'select record_payment($1, $2, $3) as record_payment', [invoiceId, 40, actor],
    )

    expect(first.rows[0].record_payment).toBe('partial')
    expect(second.rows[0].record_payment).toBe('paid')
    expect(await statusOf(invoiceId)).toBe('paid')
    expect(await paymentsFor(invoiceId)).toHaveLength(2)
  })

  it('an overpayment still settles to "paid"', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100)

    const res = await asServiceRole<{ record_payment: string }>(
      'select record_payment($1, $2, $3) as record_payment', [invoiceId, 150, actor],
    )

    expect(res.rows[0].record_payment).toBe('paid')
    expect(await statusOf(invoiceId)).toBe('paid')
  })

  it('never downgrades an already-paid invoice', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100, 'paid')

    const res = await asServiceRole<{ record_payment: string }>(
      'select record_payment($1, $2, $3) as record_payment', [invoiceId, 10, actor],
    )

    expect(res.rows[0].record_payment).toBe('paid')
    expect(await statusOf(invoiceId)).toBe('paid')
  })

  it('rejects a non-positive amount', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100)

    await expect(
      asServiceRole('select record_payment($1, $2, $3)', [invoiceId, 0, actor]),
    ).rejects.toThrow(/payment amount must be positive/)

    await expect(
      asServiceRole('select record_payment($1, $2, $3)', [invoiceId, -5, actor]),
    ).rejects.toThrow(/payment amount must be positive/)

    expect(await paymentsFor(invoiceId)).toHaveLength(0)
  })

  it('has EXECUTE revoked from anon/authenticated (service-role only)', async () => {
    // The security property is the grant model: only service_role may execute
    // the payment RPCs. We assert that directly rather than invoking the
    // function as `authenticated` — on the local PG image the permission-denied
    // path for these revoked functions segfaults the backend (an image quirk,
    // not an app issue), which would crash the whole suite.
    const sig = 'public.record_payment(uuid,numeric,uuid,date,text,text)'
    const canExecute = async (role: string) =>
      (
        await sql<{ ok: boolean }>('select has_function_privilege($1, $2, $3) as ok', [
          role,
          sig,
          'execute',
        ])
      ).rows[0].ok

    expect(await canExecute('authenticated')).toBe(false)
    expect(await canExecute('anon')).toBe(false)
    expect(await canExecute('service_role')).toBe(true)
  })
})

describe('mark_invoice_paid', () => {
  it('inserts a balancing payment so sum(payments) reconciles with total', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100)
    // 30 already paid; outstanding 70 should be auto-created.
    await asServiceRole('select record_payment($1, $2, $3)', [invoiceId, 30, actor])

    await asServiceRole('select mark_invoice_paid($1, $2)', [invoiceId, actor])

    const amounts = (await paymentsFor(invoiceId)).map((r) => Number(r.amount))
    const sum = amounts.reduce((a, b) => a + b, 0)
    expect(sum).toBe(100)
    expect(await statusOf(invoiceId)).toBe('paid')
  })

  it('creates no extra payment when nothing is outstanding', async () => {
    const { actor, invoiceId } = await arrangeInvoice(100)
    await asServiceRole('select record_payment($1, $2, $3)', [invoiceId, 100, actor])

    await asServiceRole('select mark_invoice_paid($1, $2)', [invoiceId, actor])

    expect(await paymentsFor(invoiceId)).toHaveLength(1) // only the original full payment
    expect(await statusOf(invoiceId)).toBe('paid')
  })
})
