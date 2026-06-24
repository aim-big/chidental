// Integration tests for clinic soft-delete (archived_at).
// Raw-pg harness: see ./db.ts. asUser() runs as an authenticated user
// (auth.uid()); seeding runs as the postgres superuser.
//
// NOTE: requires the local Supabase stack (`supabase start`) then
// `npm run test:integration`. These were authored alongside the feature but
// deferred from the first run (Docker/local stack was unavailable); the
// migration was applied to prod via MCP and the code verified via tsc/lint/build.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { connect, disconnect, begin, rollback, sql, asUser, seedUser, seedCustomer } from './db'

beforeAll(connect)
afterAll(disconnect)
beforeEach(begin)
afterEach(rollback)

describe('clinic archive: column + gating', () => {
  it('customers.archived_at exists and defaults to NULL', async () => {
    const id = await seedCustomer('Fresh Clinic')
    const res = await sql('select archived_at from customers where id = $1', [id])
    expect(res.rows[0].archived_at).toBeNull()
  })

  it('a customers.edit holder can archive and restore (set/clear archived_at)', async () => {
    const editor = await seedUser(['customers.view', 'customers.edit'])
    const id = await seedCustomer('Archivable')

    const archive = await asUser(editor, 'update customers set archived_at = now() where id = $1 returning archived_at', [id])
    expect(archive.ok).toBe(true)
    if (archive.ok) expect(archive.rows[0].archived_at).not.toBeNull()

    const restore = await asUser(editor, 'update customers set archived_at = null where id = $1 returning archived_at', [id])
    expect(restore.ok).toBe(true)
    if (restore.ok) expect(restore.rows[0].archived_at).toBeNull()
  })

  it('a view-only user cannot archive (RLS denies the update)', async () => {
    const viewer = await seedUser(['customers.view'])
    const id = await seedCustomer('Protected')
    const res = await asUser(viewer, 'update customers set archived_at = now() where id = $1 returning id', [id])
    expect(res.ok).toBe(false)
    if (res.ok === false) expect(res.error).toMatch(/row-level security/i)
  })
})

describe('clinic archive: filter predicate', () => {
  it('archived_at IS NULL excludes archived clinics', async () => {
    const active = await seedCustomer('Active One')
    const archived = await seedCustomer('Archived One')
    await sql('update customers set archived_at = now() where id = $1', [archived])

    const res = await sql('select id from customers where archived_at is null and id = any($1)', [[active, archived]])
    const ids = res.rows.map((r: { id: string }) => r.id)
    expect(ids).toContain(active)
    expect(ids).not.toContain(archived)
  })
})

describe('clinic archive: invoice picker inclusion', () => {
  it('active OR a specific included id passes the picker filter', async () => {
    const active = await seedCustomer('Picker Active')
    const archivedSelected = await seedCustomer('Picker Archived Selected')
    const archivedOther = await seedCustomer('Picker Archived Other')
    await sql('update customers set archived_at = now() where id = any($1)', [[archivedSelected, archivedOther]])

    // Mirrors getInvoiceFormData({ includeCustomerId: archivedSelected }).
    const res = await sql(
      'select id from customers where (archived_at is null or id = $1) and id = any($2)',
      [archivedSelected, [active, archivedSelected, archivedOther]],
    )
    const ids = res.rows.map((r: { id: string }) => r.id)
    expect(ids).toContain(active)
    expect(ids).toContain(archivedSelected)
    expect(ids).not.toContain(archivedOther)
  })
})
