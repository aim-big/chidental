// Integration tests for the Super Admin Console DB layer: invoice soft-delete
// filtering, the void-restore trigger + admin_restore_void RPC, purge cascade,
// and the clinic-purge dependency guard. SQL-level (same harness as
// archive-clinics.integration.test.ts) because RLS/triggers/cascades live in the
// database. Requires the local Supabase stack (`supabase start`) OR the linked
// remote with the 130000/130100/130200 migrations applied, then
// `npm run test:integration`.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { connect, disconnect, begin, rollback, sql, asServiceRole, seedUser, seedCustomer, seedInvoice } from './db'

beforeAll(connect)
afterAll(disconnect)
beforeEach(begin)
afterEach(rollback)

describe('invoice soft-delete', () => {
  it('invoices.deleted_at exists and defaults to NULL', async () => {
    const u = await seedUser([], { isSystem: true })
    const c = await seedCustomer('SD Clinic')
    const id = await seedInvoice({ customerId: c, createdBy: u, total: 100 })
    const res = await sql('select deleted_at from invoices where id = $1', [id])
    expect(res.rows[0].deleted_at).toBeNull()
  })

  it('deleted_at IS NULL excludes soft-deleted invoices', async () => {
    const u = await seedUser([], { isSystem: true })
    const c = await seedCustomer('SD Clinic 2')
    const live = await seedInvoice({ customerId: c, createdBy: u, total: 100 })
    const gone = await seedInvoice({ customerId: c, createdBy: u, total: 200 })
    await sql('update invoices set deleted_at = now() where id = $1', [gone])

    const res = await sql('select id from invoices where deleted_at is null and id = any($1)', [[live, gone]])
    const ids = res.rows.map((r: { id: string }) => r.id)
    expect(ids).toContain(live)
    expect(ids).not.toContain(gone)
  })
})

describe('void-restore trigger + admin_restore_void RPC', () => {
  it('clearing voided_at WITHOUT the flag is blocked', async () => {
    const u = await seedUser([], { isSystem: true })
    const c = await seedCustomer('VR Clinic')
    const id = await seedInvoice({ customerId: c, createdBy: u, total: 100 })
    await sql('update invoices set voided_at = now() where id = $1', [id])
    await expect(sql('update invoices set voided_at = null where id = $1', [id])).rejects.toThrow(/cannot be restored/i)
  })

  it('admin_restore_void clears voided_at via the service role', async () => {
    const u = await seedUser([], { isSystem: true })
    const c = await seedCustomer('VR Clinic 2')
    const id = await seedInvoice({ customerId: c, createdBy: u, total: 100 })
    await sql('update invoices set voided_at = now() where id = $1', [id])
    const r = await asServiceRole('select public.admin_restore_void($1)', [id])
    expect(r).toBeTruthy()
    const res = await sql('select voided_at from invoices where id = $1', [id])
    expect(res.rows[0].voided_at).toBeNull()
  })
})

describe('purge cascade', () => {
  it('deleting an invoice cascades its items and payments', async () => {
    const u = await seedUser([], { isSystem: true })
    const c = await seedCustomer('Purge Clinic')
    const id = await seedInvoice({ customerId: c, createdBy: u, total: 100 })
    await sql(
      `insert into invoice_items (invoice_id, description, quantity, unit_price, amount)
       values ($1, 'x', 1, 100, 100)`, [id])
    await sql(
      `insert into payments (invoice_id, amount, payment_date, created_by)
       values ($1, 50, current_date, $2)`, [id, u])

    await sql('delete from invoices where id = $1', [id])
    const items = await sql('select id from invoice_items where invoice_id = $1', [id])
    const pays = await sql('select id from payments where invoice_id = $1', [id])
    expect(items.rows).toHaveLength(0)
    expect(pays.rows).toHaveLength(0)
  })
})

describe('clinic purge dependency guard (FK RESTRICT)', () => {
  it('cannot hard-delete a clinic that still has an invoice', async () => {
    const u = await seedUser([], { isSystem: true })
    const c = await seedCustomer('Dep Clinic')
    await seedInvoice({ customerId: c, createdBy: u, total: 100 })
    await expect(sql('delete from customers where id = $1', [c])).rejects.toThrow()
  })

  it('can hard-delete a clinic with no dependents', async () => {
    const c = await seedCustomer('Free Clinic')
    await sql('delete from customers where id = $1', [c])
    const res = await sql('select id from customers where id = $1', [c])
    expect(res.rows).toHaveLength(0)
  })
})

describe('admin_audit_log', () => {
  it('accepts a normalized audit row', async () => {
    const u = await seedUser([], { isSystem: true })
    const r = await sql(
      `insert into admin_audit_log (actor_id, action, entity_type, entity_label)
       values ($1, 'invoice.purge', 'invoice', 'INV-TEST') returning id`, [u])
    expect(r.rows[0].id).toBeTruthy()
  })
})
