// Integration-test database harness.
//
// These tests run against a REAL Postgres with the project's migrations applied
// (the local Supabase stack), because the things under test — payment RPCs and
// permission-enforcing RLS — live in the database and cannot be exercised by the
// pure-logic unit tests. Bring the stack up first:
//
//     supabase start
//
// then:  npm run test:integration
//
// Connection defaults to the standard local Supabase DB; override with
// SUPABASE_DB_URL to point at a branch or CI database.
//
// Isolation: one shared connection, one transaction per test (begin/rollback in
// hooks), so tests never see each other's writes and nothing is persisted.
//
// Role model — we reproduce production's three execution contexts at the SQL
// level instead of going through PostgREST, so the suite only needs the `db`
// container (no auth/rest/storage), which keeps it fast and robust:
//   - postgres (superuser) ......... seeding/arrange — see `sql()`
//   - service_role ................. the server-action / RPC path — `asServiceRole()`
//   - authenticated + jwt claims ... the browser/RLS path — `asUser()`

import { Client, type QueryResultRow } from 'pg'
import { randomUUID } from 'node:crypto'

const CONNECTION =
  process.env.SUPABASE_DB_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let client: Client | null = null

/** Connect once (call from beforeAll). Fails loudly if the stack isn't up. */
export async function connect(): Promise<void> {
  if (client) return
  const c = new Client({ connectionString: CONNECTION, connectionTimeoutMillis: 3000 })
  try {
    await c.connect()
  } catch (e) {
    throw new Error(
      `Cannot reach a Postgres at ${CONNECTION}.\n` +
        `Start the local Supabase stack first:  supabase start\n` +
        `(or set SUPABASE_DB_URL to a branch/CI database).\n` +
        `Underlying error: ${(e as Error).message}`,
    )
  }
  client = c
}

/** Disconnect (call from afterAll). */
export async function disconnect(): Promise<void> {
  if (client) {
    await client.end()
    client = null
  }
}

function db(): Client {
  if (!client) throw new Error('db harness used before connect()')
  return client
}

/** Per-test transaction boundaries — wire into beforeEach/afterEach. */
export const begin = () => db().query('begin')
export const rollback = () => db().query('rollback')

/** Run SQL as the postgres superuser — used to arrange fixtures. */
export function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return db().query<T>(text, params)
}

/**
 * Run SQL as the Supabase `service_role` — the role the server actions use via
 * the service-role client. Bypasses RLS and is the only role allowed to execute
 * the invoice/payment RPCs.
 */
export async function asServiceRole<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  const c = db()
  await c.query('savepoint sr')
  await c.query('set local role service_role')
  try {
    const r = await c.query<T>(text, params)
    await c.query('reset role')
    await c.query('release savepoint sr')
    return r
  } catch (e) {
    // A raised RPC aborts the (sub)transaction; rolling back to the savepoint
    // recovers it and reverts the role, then we re-throw the ORIGINAL error so
    // callers can assert on its message (not a "transaction is aborted" mask).
    await c.query('rollback to savepoint sr')
    throw e
  }
}

export type Attempt =
  | { ok: true; rows: QueryResultRow[] }
  | { ok: false; error: string }

/**
 * Run SQL as a specific authenticated user — the browser path that RLS guards.
 * `userId` becomes auth.uid() via the request.jwt.claims GUC. Savepoint-wrapped
 * so an expected RLS denial doesn't poison the surrounding test transaction.
 */
export async function asUser(
  userId: string,
  text: string,
  params: unknown[] = [],
): Promise<Attempt> {
  const c = db()
  await c.query('savepoint au')
  await c.query('set local role authenticated')
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
  try {
    const r = await c.query(text, params)
    await c.query('reset role')
    await c.query('release savepoint au')
    return { ok: true, rows: r.rows }
  } catch (e) {
    // The failed statement aborts the (sub)transaction; rolling back to the
    // savepoint recovers it and reverts the role/claims GUCs in one step.
    await c.query('rollback to savepoint au')
    return { ok: false, error: (e as Error).message }
  }
}

// ── Fixture seeders (all run as postgres) ───────────────────────────────────

export const newId = () => randomUUID()

/** Minimal auth.users row (profiles/invoices/payments FK to it). */
export async function seedAuthUser(id: string = newId()): Promise<string> {
  await sql('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@test.local`])
  return id
}

/** A role plus its permission rows. `isSystem` => super-admin (implicit all). */
export async function seedRole(
  name: string,
  permissions: string[] = [],
  isSystem = false,
): Promise<string> {
  const id = newId()
  await sql('insert into roles (id, name, is_system) values ($1, $2, $3)', [id, name, isSystem])
  for (const perm of permissions) {
    await sql('insert into role_permissions (role_id, permission) values ($1, $2)', [id, perm])
  }
  return id
}

/**
 * An auth user + active profile bound to a fresh role holding `permissions`.
 * Returns the user id to pass to asUser(). `isSystem` makes it a super-admin.
 */
export async function seedUser(
  permissions: string[] = [],
  { isSystem = false }: { isSystem?: boolean } = {},
): Promise<string> {
  const userId = await seedAuthUser()
  const roleId = await seedRole(`role-${userId.slice(0, 8)}`, permissions, isSystem)
  await sql(
    'insert into profiles (id, username, role_id, active) values ($1, $2, $3, true)',
    [userId, userId.slice(0, 8), roleId],
  )
  return userId
}

export async function seedCustomer(name = 'Test Clinic'): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    'insert into customers (clinic_name) values ($1) returning id',
    [name],
  )
  return rows[0].id
}

export async function seedProduct(
  name = 'Test Product',
  { unitPrice = 0, min = null, max = null }: { unitPrice?: number; min?: number | null; max?: number | null } = {},
): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    'insert into products (name, unit_price, min_unit_price, max_unit_price) values ($1, $2, $3, $4) returning id',
    [name, unitPrice, min, max],
  )
  return rows[0].id
}

/** An invoice (invoice_number is filled by the set_invoice_number_default trigger). */
export async function seedInvoice({
  customerId,
  createdBy,
  total,
  status = 'sent',
}: {
  customerId: string
  createdBy: string
  total: number
  status?: string
}): Promise<string> {
  const { rows } = await sql<{ id: string }>(
    `insert into invoices (customer_id, created_by, due_date, subtotal, total, status)
     values ($1, $2, current_date + 30, $3, $3, $4) returning id`,
    [customerId, createdBy, total, status],
  )
  return rows[0].id
}
