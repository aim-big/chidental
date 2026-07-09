// Integration tests for the Super Admin clinic cascade-delete (admin_purge_clinic).
// Raw-pg harness: see ./db.ts. asServiceRole() is the server-action/RPC path;
// asUser() is the browser/RLS path.
//
// NOTE: requires the local Supabase stack (`supabase start`) then
// `npm run test:integration`. Authored alongside the feature; the migration was
// applied to prod via MCP and the code verified via build. Deferred from the first
// run when the local Docker stack is unavailable — same posture as the other
// integration suites here.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { connect, disconnect, begin, rollback, sql, asServiceRole, asUser, seedUser, seedCustomer, seedInvoice } from './db'

beforeAll(connect)
afterAll(disconnect)
beforeEach(begin)
afterEach(rollback)

// Seed a clinic with two invoices (each with a line item + a payment) and one
// credit, so the cascade has something to delete at every level.
async function seedClinicWithHistory() {
  const user = await seedUser([], { isSystem: true })
  const clinic = await seedCustomer('Cascade Clinic')

  const inv1 = await seedInvoice({ customerId: clinic, createdBy: user, total: 100 })
  const inv2 = await seedInvoice({ customerId: clinic, createdBy: user, total: 200 })
  for (const inv of [inv1, inv2]) {
    await sql('insert into invoice_items (invoice_id, description) values ($1, $2)', [inv, 'Crown'])
    await sql('insert into payments (invoice_id, amount, created_by) values ($1, $2, $3)', [inv, 50, user])
  }
  await sql('insert into credits (customer_id, amount, created_by, reason) values ($1, $2, $3, $4)', [clinic, 25, user, 'goodwill'])

  return { user, clinic, invoiceIds: [inv1, inv2] }
}

describe('admin_purge_clinic: cascade', () => {
  it('deletes the clinic and every record hanging off it, in one call', async () => {
    const { clinic, invoiceIds } = await seedClinicWithHistory()

    const res = await asServiceRole<{ result: { credits: number; invoices: number } }>(
      'select public.admin_purge_clinic($1) as result',
      [clinic],
    )
    expect(res.rows[0].result).toEqual({ credits: 1, invoices: 2 })

    const gone = async (text: string, params: unknown[]) =>
      Number((await sql<{ count: string }>(text, params)).rows[0].count)

    expect(await gone('select count(*) from customers where id = $1', [clinic])).toBe(0)
    expect(await gone('select count(*) from invoices where customer_id = $1', [clinic])).toBe(0)
    expect(await gone('select count(*) from invoice_items where invoice_id = any($1)', [invoiceIds])).toBe(0)
    expect(await gone('select count(*) from payments where invoice_id = any($1)', [invoiceIds])).toBe(0)
    expect(await gone('select count(*) from credits where customer_id = $1', [clinic])).toBe(0)
  })

  it('is a no-op that reports zero counts for an unknown clinic id', async () => {
    const res = await asServiceRole<{ result: { credits: number; invoices: number } }>(
      'select public.admin_purge_clinic($1) as result',
      ['00000000-0000-0000-0000-000000000000'],
    )
    expect(res.rows[0].result).toEqual({ credits: 0, invoices: 0 })
  })
})

describe('admin_purge_clinic: lockdown', () => {
  it('cannot be executed by an authenticated user (even a Super Admin) — service role only', async () => {
    const superAdmin = await seedUser([], { isSystem: true })
    const clinic = await seedCustomer('Should Survive')

    const attempt = await asUser(superAdmin, 'select public.admin_purge_clinic($1)', [clinic])
    expect(attempt.ok).toBe(false)
    if (attempt.ok === false) expect(attempt.error).toMatch(/permission denied/i)

    // The clinic is untouched.
    const still = await sql('select id from customers where id = $1', [clinic])
    expect(still.rows).toHaveLength(1)
  })
})
