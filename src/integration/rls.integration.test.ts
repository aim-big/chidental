// Integration tests for the permission-enforcing RLS layer
// (supabase/migrations/20260619000000_rls_permission_enforcement.sql).
//
// The threat these policies close: an authenticated user hitting the PostgREST
// API directly, bypassing the UI/server-action permission checks. We assert the
// database itself allows/denies writes per the same permission model.
//
// See ./db.ts — asUser() runs as a specific authenticated user (its id becomes
// auth.uid()); seeding runs as the postgres superuser.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import {
  connect,
  disconnect,
  begin,
  rollback,
  sql,
  asUser,
  seedUser,
  seedAuthUser,
  seedRole,
  seedCustomer,
  seedInvoice,
} from './db'

beforeAll(connect)
afterAll(disconnect)
beforeEach(begin)
afterEach(rollback)

describe('RLS: customers write-gating', () => {
  it('allows insert for a user holding customers.edit', async () => {
    const editor = await seedUser(['customers.view', 'customers.edit'])
    const res = await asUser(editor, "insert into customers (clinic_name) values ('Acme') returning id")
    expect(res.ok).toBe(true)
  })

  it('denies insert for a view-only user', async () => {
    const viewer = await seedUser(['customers.view'])
    const res = await asUser(viewer, "insert into customers (clinic_name) values ('Acme') returning id")
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.error).toMatch(/row-level security/i)
  })

  it('allows insert for a super-admin (is_system) role', async () => {
    const admin = await seedUser([], { isSystem: true })
    const res = await asUser(admin, "insert into customers (clinic_name) values ('Acme') returning id")
    expect(res.ok).toBe(true)
  })

  it('allows update and delete for a user holding customers.edit', async () => {
    const editor = await seedUser(['customers.view', 'customers.edit'])
    const customerId = await seedCustomer('Before')

    const upd = await asUser(editor, 'update customers set clinic_name = $2 where id = $1 returning id', [customerId, 'After'])
    expect(upd.ok).toBe(true)
    if (upd.ok) expect(upd.rows).toHaveLength(1)

    const del = await asUser(editor, 'delete from customers where id = $1 returning id', [customerId])
    expect(del.ok).toBe(true)
    if (del.ok) expect(del.rows).toHaveLength(1)
  })

  it('lets any authenticated user read customers (reads are intentionally broad)', async () => {
    const customerId = await seedCustomer('Readable')
    const viewer = await seedUser(['customers.view'])
    const res = await asUser(viewer, 'select id from customers where id = $1', [customerId])
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.rows).toHaveLength(1)
  })
})

describe('RLS: products write-gating', () => {
  it('allows insert for products.edit, denies otherwise', async () => {
    const editor = await seedUser(['products.view', 'products.edit'])
    const viewer = await seedUser(['products.view'])

    const ok = await asUser(editor, "insert into products (name) values ('Crown') returning id")
    expect(ok.ok).toBe(true)

    const denied = await asUser(viewer, "insert into products (name) values ('Crown') returning id")
    expect(denied.ok).toBe(false)
    if (denied.ok === false) expect(denied.error).toMatch(/row-level security/i)
  })
})

describe('RLS: invoices & payments have no authenticated write path', () => {
  it('denies a direct invoice insert even for a super-admin user', async () => {
    const admin = await seedUser([], { isSystem: true })
    const customerId = await seedCustomer()
    const res = await asUser(
      admin,
      `insert into invoices (customer_id, created_by, due_date, subtotal, total)
       values ($1, $1, current_date + 30, 0, 0) returning id`,
      [customerId],
    )
    // Denied before the row is written: the set_invoice_number_default trigger
    // calls generate_invoice_number(), whose EXECUTE is revoked from
    // authenticated — so the insert never reaches the (also absent) write policy.
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.error).toMatch(/permission denied|row-level security/i)
  })

  it('denies a direct payment insert even for a super-admin user', async () => {
    const admin = await seedUser([], { isSystem: true })
    const actor = await seedUser([], { isSystem: true })
    const customerId = await seedCustomer()
    const invoiceId = await seedInvoice({ customerId, createdBy: actor, total: 100 })

    const res = await asUser(
      admin,
      'insert into payments (invoice_id, amount, created_by) values ($1, 50, $2) returning id',
      [invoiceId, actor],
    )
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.error).toMatch(/row-level security/i)
  })
})

describe('RLS: invoice_items column-restricted update', () => {
  async function seedItem() {
    const actor = await seedUser([], { isSystem: true })
    const customerId = await seedCustomer()
    const invoiceId = await seedInvoice({ customerId, createdBy: actor, total: 100 })
    const { rows } = await sql<{ id: string }>(
      "insert into invoice_items (invoice_id, description, unit_price) values ($1, 'Item', 50) returning id",
      [invoiceId],
    )
    return { invoiceId, itemId: rows[0].id }
  }

  it('allows a invoices.view user to update the work-status columns', async () => {
    const { itemId } = await seedItem()
    const user = await seedUser(['invoices.view'])

    const res = await asUser(
      user,
      "update invoice_items set work_status = 'in_progress' where id = $1 returning work_status",
      [itemId],
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.rows).toHaveLength(1)
      expect(res.rows[0].work_status).toBe('in_progress')
    }
  })

  it('denies updating price/qty/description columns (column-level revoke)', async () => {
    const { itemId } = await seedItem()
    const user = await seedUser(['invoices.view'])

    const res = await asUser(user, 'update invoice_items set unit_price = 999 where id = $1', [itemId])
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.error).toMatch(/permission denied/i)
  })

  it('updates zero rows when the user lacks invoices.view (RLS filters the row)', async () => {
    const { itemId } = await seedItem()
    const user = await seedUser(['customers.view']) // no invoices.view

    const res = await asUser(
      user,
      "update invoice_items set work_status = 'ready' where id = $1 returning id",
      [itemId],
    )
    // USING(false) hides the row from the update -> 0 rows affected, not an error.
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.rows).toHaveLength(0)
  })

  it('denies a direct invoice_items insert (no insert policy)', async () => {
    const { invoiceId } = await seedItem()
    const user = await seedUser(['invoices.view'])

    const res = await asUser(
      user,
      "insert into invoice_items (invoice_id, description) values ($1, 'Sneaky') returning id",
      [invoiceId],
    )
    expect(res.ok).toBe(false)
  })
})

describe('RLS: privileged RPCs are service-role only', () => {
  // We assert the grant model directly. Do NOT invoke these functions as
  // `authenticated` — on the local PG image the permission-denied path for a
  // revoked function segfaults the backend (an image quirk, not an app issue).
  it('have EXECUTE revoked from anon/authenticated but kept for service_role', async () => {
    const sigs = [
      'public.create_invoice_with_items(jsonb,jsonb)',
      'public.update_invoice_with_items(uuid,jsonb,jsonb)',
      'public.record_payment(uuid,numeric,uuid,date,text,text)',
      'public.mark_invoice_paid(uuid,uuid,text)',
    ]
    const canExecute = async (role: string, sig: string) =>
      (
        await sql<{ ok: boolean }>('select has_function_privilege($1, $2, $3) as ok', [role, sig, 'execute'])
      ).rows[0].ok

    for (const sig of sigs) {
      expect(await canExecute('authenticated', sig), `${sig} / authenticated`).toBe(false)
      expect(await canExecute('anon', sig), `${sig} / anon`).toBe(false)
      expect(await canExecute('service_role', sig), `${sig} / service_role`).toBe(true)
    }
  })
})

describe('auth_has_permission()', () => {
  const check = async (userId: string, perm: string) => {
    const res = await asUser(userId, 'select auth_has_permission($1) as ok', [perm])
    if (res.ok === false) throw new Error(`unexpected denial: ${res.error}`)
    return res.rows[0].ok as boolean
  }

  it('is true for a super-admin, regardless of the permission asked', async () => {
    const admin = await seedUser([], { isSystem: true })
    expect(await check(admin, 'customers.edit')).toBe(true)
    expect(await check(admin, 'settings.manage')).toBe(true)
  })

  it('is true only for permissions the role actually holds', async () => {
    const user = await seedUser(['customers.edit'])
    expect(await check(user, 'customers.edit')).toBe(true)
    expect(await check(user, 'products.edit')).toBe(false)
  })

  it('is false for an inactive profile even if the role holds the permission', async () => {
    const userId = await seedAuthUser()
    const roleId = await seedRole('Inactive Editor', ['customers.edit'])
    await sql('insert into profiles (id, username, role_id, active) values ($1, $2, $3, false)', [
      userId,
      userId.slice(0, 8),
      roleId,
    ])
    expect(await check(userId, 'customers.edit')).toBe(false)
  })
})
