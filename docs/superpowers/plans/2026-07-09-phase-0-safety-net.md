# Phase 0 — Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This is the detailed plan for **Phase 0** of `2026-07-09-nestjs-migration-roadmap.md`.
> Everything here is valuable even if the migration stops tomorrow: a CI gate, every
> server-action input validated by a shared Zod schema (these schemas become the Nest
> DTOs in Phase 3), a login tripwire test, and a documented staging/env story.

**Goal:** Establish a safety net — CI gate, complete input-validation at every server-action boundary, a login/session tripwire test, and a documented staging environment — with zero user-visible behavior change.

**Architecture:** Pure additive hardening of the existing single Next.js app. New GitHub Actions workflow runs the existing `npm test` + `npm run build`. The already-existing `src/domain/schemas.ts` is completed so every exported server action `safeParse`s its full input before the first DB call, following the pattern already used by `customer-actions.ts`. A `@supabase/ssr`-mocked unit test locks in the middleware redirect logic, and a Playwright smoke exercises a real login against a seeded local stack. No schema changes, no dependency major bumps, no restructure.

**Tech Stack:** Next.js 16 / React 19, Supabase (`@supabase/ssr` + service-role), Zod 4 (`src/domain/schemas.ts`), Vitest 4 (unit + integration configs), Playwright (new dev dep), GitHub Actions.

## Global Constraints

- UI copy always says **"Clinic"**; code/DB/routes/types/permission keys stay `customer` (docs/CONVENTIONS.md). Do not rename anything.
- Money rules per docs/CONVENTIONS.md. Do NOT alter any arithmetic, RPC, or audit-write behavior — this phase only *validates inputs* and *adds tests*.
- Gates for every PR: `npm test` and `npm run build` must pass. tsc/lint are NOT gates (per project memory: tsc & lint are unusable here).
- Node >= 20.12, npm (`package-lock.json`). Do NOT switch package managers. Do NOT bump any dependency's major version.
- Dev server port is **6060** (`next dev -p 6060`). Playwright baseURL uses 6060.
- DB migrations (none needed in Phase 0) go through Supabase MCP `apply_migration` with prod-aligned version timestamps. The seed file is NOT a migration.
- Audit writes (`admin_audit_log`, `invoice_activity_log`) must be preserved verbatim — validation is inserted *before* the DB call, never around the audit-log call.
- Validation must be **backward compatible**: a schema may only reject input the current code would have mis-stored. Every schema is checked against its real call site (the action's declared param type) in the same task.
- Never point Preview/staging at prod data. The remote prod project ref is `xjwkmlmkwpbxjziyngmb` (do not use it for staging).

---

## File Structure

**Created:**
- `.github/workflows/ci.yml` — CI gate: `npm ci` → `npm test` → `npm run build`.
- `src/lib/supabase/middleware.test.ts` — unit test for `updateSession()` redirect logic (mocks `@supabase/ssr`).
- `supabase/seed.sql` — deterministic local/staging seed (one confirmed login user + super-admin role + sample clinic/product/invoice). Referenced by the existing `config.toml` `[db.seed]`.
- `playwright.config.ts` — Playwright config (baseURL `http://localhost:6060`, testDir `e2e/`).
- `e2e/login.smoke.spec.ts` — real-browser login → dashboard smoke + unauth-redirect assertion.
- `e2e/helpers.ts` — `login()` helper + seeded test-user credentials.
- `docs/runbooks/staging-provisioning.md` — owner-action runbook for creating the staging Supabase project + Vercel Preview vars.

**Modified:**
- `src/domain/schemas.ts` — add id/payload schemas so every action has a full-input schema; reconcile `paymentInputSchema.reference_number` → `reference`; port `validateBillingSettings` → `billingSettingsInputSchema`.
- `src/domain/schemas.test.ts` — unit tests for the new/changed schemas.
- `src/data/invoice-actions.ts` — `safeParse` every action's full input before its first DB call.
- `src/data/customer-actions.ts` — validate `id` on update/archive/restore.
- `src/data/product-actions.ts` — validate `id`/`active` on update/toggle.
- `src/data/credits.ts` — validate `customerId` on read/create.
- `src/data/billing-settings.ts` — swap manual `validateBillingSettings` for `billingSettingsInputSchema.safeParse`.
- `.env.example` — document `SUPABASE_DB_URL` (integration tests) as an optional var.
- `package.json` — add `test:e2e` script.
- `docs/ARCHITECTURE.md` — new "Deployment & environment matrix" section.
- `docs/testing.md` — note the new E2E tier + middleware unit test.
- `docs/CONVENTIONS.md` — record the Phase 0 decisions (CI gate, "validate every action input at the boundary" rule, staging never touches prod data).

---

## Task 1: CI gate (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a CI workflow that runs `npm test` and `npm run build` on every PR and on pushes to `main`. Later phases add jobs to this file.

- [ ] **Step 1: Verify the two gate commands pass locally first**

Run: `npm test`
Expected: PASS (all unit suites green; no DB needed).

Run: `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon SUPABASE_SERVICE_ROLE_KEY=dummy-service npm run build`
Expected: `next build` completes ("Compiled successfully" / route table printed). The dummy vars exist only so any statically-evaluated Supabase client factory doesn't throw during prerender.

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

# Cancel superseded runs on the same ref to save minutes.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  gate:
    name: test + build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Unit tests
        run: npm test

      - name: Build
        # Dummy Supabase vars: the client factories read these lazily, but a
        # statically-prerendered page could still evaluate one. Real secrets are
        # never needed to compile — only to run.
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key
          SUPABASE_SERVICE_ROLE_KEY: dummy-service-role-key
        run: npm run build
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions gate (npm test + npm run build)"
```

Note (owner action, not a code step): GitHub Actions runs automatically once this file is on a branch in the repo; no dashboard toggle is required. The **integration** tests (`npm run test:integration`, need Docker + `supabase start`) are intentionally NOT in this gate — they get a Postgres-service job in a later phase.

---

## Task 2: Complete + unit-test the shared Zod schemas

This is the DTO foundation. Pure functions, fully unit-testable, CI-safe. No action files change here.

**Files:**
- Modify: `src/domain/schemas.ts`
- Test: `src/domain/schemas.test.ts`

**Interfaces:**
- Produces (imported by Tasks 3–5): `idSchema`, `nullableIdSchema`, `invoicePayloadSchema`, `invoiceItemPayloadSchema`, `createInvoiceInputSchema`, `updateInvoiceInputSchema`, `recordPaymentInputSchema`, `caseDetailsSchema`, `serviceStatusInputSchema`, `recipientFieldsSchema`, `workStatusInputSchema`, `workNoteInputSchema`, `toggleActiveInputSchema`, `billingSettingsInputSchema`.
- Changes: `paymentInputSchema` field `reference_number` → `reference` (renamed to match the live `recordPaymentAction` input; the schema was dead except in this test file).

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/schemas.test.ts`:

```ts
import {
  idSchema,
  invoicePayloadSchema,
  invoiceItemPayloadSchema,
  createInvoiceInputSchema,
  recordPaymentInputSchema,
  workStatusInputSchema,
  billingSettingsInputSchema,
} from './schemas'

describe('idSchema', () => {
  it('accepts a uuid', () => {
    expect(idSchema.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(true)
  })
  it('rejects a non-uuid string', () => {
    expect(idSchema.safeParse('not-an-id').success).toBe(false)
  })
})

describe('invoiceItemPayloadSchema', () => {
  const base = { product_id: null, description: 'Crown', quantity: 1, unit_price: 100, amount: 100 }
  it('accepts a valid line', () => {
    expect(invoiceItemPayloadSchema.safeParse(base).success).toBe(true)
  })
  it('rejects a non-positive quantity', () => {
    expect(invoiceItemPayloadSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false)
  })
  it('rejects an empty description', () => {
    expect(invoiceItemPayloadSchema.safeParse({ ...base, description: '' }).success).toBe(false)
  })
})

describe('createInvoiceInputSchema', () => {
  const invoice = {
    customer_id: '00000000-0000-0000-0000-000000000001',
    invoice_date: '2026-07-09', due_date: '2026-08-08',
    notes: null, patient: null, doctor: null, service_status_id: null,
    bill_to_name: null, bill_to_contact: null, bill_to_phone: null, billing_address: null,
    ship_to_name: null, ship_to_contact: null, delivery_address: null,
    subtotal: 100, total: 100, status: 'draft' as const,
  }
  const items = [{ id: null, product_id: null, description: 'Crown', quantity: 1, unit_price: 100, amount: 100 }]
  it('accepts a valid create payload', () => {
    expect(createInvoiceInputSchema.safeParse({ p_invoice: invoice, p_items: items }).success).toBe(true)
  })
  it('rejects an empty items array', () => {
    expect(createInvoiceInputSchema.safeParse({ p_invoice: invoice, p_items: [] }).success).toBe(false)
  })
  it('rejects an unknown status', () => {
    expect(createInvoiceInputSchema.safeParse({ p_invoice: { ...invoice, status: 'paid' }, p_items: items }).success).toBe(false)
  })
})

describe('recordPaymentInputSchema', () => {
  it('accepts amount + optional reference', () => {
    expect(recordPaymentInputSchema.safeParse({ amount: 50, reference: 'TXN-1' }).success).toBe(true)
  })
  it('rejects a non-positive amount', () => {
    expect(recordPaymentInputSchema.safeParse({ amount: 0 }).success).toBe(false)
  })
})

describe('workStatusInputSchema', () => {
  it('accepts a known work_status', () => {
    expect(workStatusInputSchema.safeParse({ work_status: 'in_progress', stage_id: null }).success).toBe(true)
  })
  it('rejects an unknown work_status', () => {
    expect(workStatusInputSchema.safeParse({ work_status: 'shipped', stage_id: null }).success).toBe(false)
  })
})

describe('billingSettingsInputSchema', () => {
  const base = { bankName: 'Maybank', accountName: 'Chi Dental', accountNumber: '123', paymentNote: 'x', invoiceNotes: ['a'], paymentTermsDays: 30 }
  it('accepts valid settings', () => {
    expect(billingSettingsInputSchema.safeParse(base).success).toBe(true)
  })
  it('rejects a blank bank name', () => {
    expect(billingSettingsInputSchema.safeParse({ ...base, bankName: '   ' }).success).toBe(false)
  })
  it('rejects payment terms below 1 day', () => {
    expect(billingSettingsInputSchema.safeParse({ ...base, paymentTermsDays: 0 }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- schemas`
Expected: FAIL — the imported symbols (`idSchema`, `invoicePayloadSchema`, …) don't exist yet.

- [ ] **Step 3: Add the schemas**

In `src/domain/schemas.ts`, rename the `paymentInputSchema` field and append the new schemas. First, change lines 25–30 so the dead `paymentInputSchema` matches the live action input:

```ts
export const paymentInputSchema = z.object({
  amount: z.number().positive(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference: z.string().optional(),   // was `reference_number`; the live action input uses `reference`
  notes: z.string().optional(),
})
```

Then append, after the existing `productInputSchema` block (before the `export type` lines):

```ts
// ── Phase 0: id / primitive guards (defense-in-depth on id + scalar params) ──
export const idSchema = z.string().uuid()
export const nullableIdSchema = z.string().uuid().nullable()

// ── Invoice server-action payloads (accurate to invoice-actions.ts inputs) ──
// These mirror InvoicePayload / InvoiceItemPayload in src/data/invoice-actions.ts
// and become the Nest DTOs in Phase 3. Keep the field lists in sync.
export const invoicePayloadSchema = z.object({
  customer_id: z.string().uuid(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable(),
  patient: z.string().nullable(),
  doctor: z.string().nullable(),
  service_status_id: z.string().uuid().nullable(),
  bill_to_name: z.string().nullable(),
  bill_to_contact: z.string().nullable(),
  bill_to_phone: z.string().nullable(),
  billing_address: z.string().nullable(),
  ship_to_name: z.string().nullable(),
  ship_to_contact: z.string().nullable(),
  delivery_address: z.string().nullable(),
  subtotal: z.number().min(0),
  total: z.number().min(0),
})
export const invoiceItemPayloadSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  amount: z.number().min(0),
})
export const createInvoiceInputSchema = z.object({
  p_invoice: invoicePayloadSchema.extend({ status: z.enum(['draft', 'sent']) }),
  p_items: z.array(invoiceItemPayloadSchema).min(1),
})
export const updateInvoiceInputSchema = z.object({
  p_invoice: invoicePayloadSchema,
  p_items: z.array(invoiceItemPayloadSchema).min(1),
})

// Reuse the reconciled paymentInputSchema under the action-scoped name.
export const recordPaymentInputSchema = paymentInputSchema

export const caseDetailsSchema = z.object({
  patient: z.string().nullable(),
  doctor: z.string().nullable(),
})
export const serviceStatusInputSchema = z.object({
  serviceStatusId: z.string().uuid().nullable(),
})
export const recipientFieldsSchema = z.object({
  bill_to_name: z.string().nullable(),
  bill_to_contact: z.string().nullable(),
  bill_to_phone: z.string().nullable(),
  billing_address: z.string().nullable(),
  ship_to_name: z.string().nullable(),
  ship_to_contact: z.string().nullable(),
  delivery_address: z.string().nullable(),
})

// Mirror of the `work_status` DB enum (src/lib/work-status WORK_STATUSES).
export const workStatusInputSchema = z.object({
  work_status: z.enum(['received', 'in_progress', 'ready', 'delivered', 'on_hold']),
  stage_id: z.string().uuid().nullable(),
})
export const workNoteInputSchema = z.object({
  workNote: z.string().nullable(),
})
export const toggleActiveInputSchema = z.object({
  active: z.boolean(),
})

// Port of validateBillingSettings (src/lib/billing-settings.ts): required bank
// fields (after trim) + payment terms >= 1 whole day. Same messages so error
// text the UI shows is unchanged.
export const billingSettingsInputSchema = z.object({
  bankName: z.string().trim().min(1, 'Bank name is required.'),
  accountName: z.string().trim().min(1, 'Account name is required.'),
  accountNumber: z.string().trim().min(1, 'Account number is required.'),
  paymentNote: z.string(),
  invoiceNotes: z.array(z.string()),
  paymentTermsDays: z.number().refine((n) => Number.isFinite(n) && n >= 1, 'Payment terms must be at least 1 day.'),
})
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- schemas`
Expected: PASS — all new describe blocks green, existing schema tests still green (update any test referencing `paymentInputSchema` / `reference_number`: change the field name to `reference`).

- [ ] **Step 5: Commit**

```bash
git add src/domain/schemas.ts src/domain/schemas.test.ts
git commit -m "feat(schemas): add server-action input schemas (future Nest DTOs)"
```

---

## Task 3: Wire validation into every invoice server action

`invoice-actions.ts` has the largest gap (from the audit: 10 unvalidated, 6 partial). Insert a `safeParse` of each action's full input immediately after its permission gate and before its first DB call. Do NOT touch the money cross-check, RPC calls, or audit-log writes.

**Files:**
- Modify: `src/data/invoice-actions.ts`

**Interfaces:**
- Consumes: `createInvoiceInputSchema`, `updateInvoiceInputSchema`, `recordPaymentInputSchema`, `idSchema`, `caseDetailsSchema`, `serviceStatusInputSchema`, `recipientFieldsSchema`, `workStatusInputSchema`, `workNoteInputSchema` from `@/domain/schemas`.
- Preserves: every existing return shape (`CreateResult` / local `ActionResult = {ok:true}|{ok:false;error}`), all `logInvoiceActivity` calls, `gateForContentEdit`, `invoiceMoneyError`.

- [ ] **Step 1: Add the import**

At the top of `src/data/invoice-actions.ts`, add:

```ts
import {
  createInvoiceInputSchema,
  updateInvoiceInputSchema,
  recordPaymentInputSchema,
  idSchema,
  caseDetailsSchema,
  serviceStatusInputSchema,
  recipientFieldsSchema,
  workStatusInputSchema,
  workNoteInputSchema,
} from '@/domain/schemas'
```

Add a tiny local helper near the top (after the type definitions, ~line 106) so each site is one line:

```ts
// Parse-or-fail for this file's local ActionResult shape.
function invalid(message: string | undefined): { ok: false; error: string } {
  return { ok: false, error: message ?? 'Invalid input' }
}
```

- [ ] **Step 2: Validate `createInvoiceAction`**

After `if (gate.ok === false) return gate` (line 141), before the money cross-check:

```ts
  const parsed = createInvoiceInputSchema.safeParse(payload)
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message)
```

- [ ] **Step 3: Validate `updateInvoiceAction`**

After `if (!gate.ok) return gate` (line 178), before the money cross-check. Also validate the `id`:

```ts
  if (!idSchema.safeParse(id).success) return invalid('Invalid invoice id')
  const parsed = updateInvoiceInputSchema.safeParse(payload)
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message)
```

- [ ] **Step 4: Validate `recordPaymentAction`**

After `if (!gate.ok) return gate` (line 221):

```ts
  if (!idSchema.safeParse(id).success) return invalid('Invalid invoice id')
  const parsed = recordPaymentInputSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message)
```

- [ ] **Step 5: Validate the remaining id-only / small-input actions**

- `markSentAction` (line 242): after the gate, `if (!idSchema.safeParse(id).success) return invalid('Invalid invoice id')`.
- `updateWorkStatusAction` (line 265): after the gate, `if (!idSchema.safeParse(itemId).success) return invalid('Invalid item id')` and `if (!workStatusInputSchema.safeParse(input).success) return invalid('Invalid work status')`.
- `updateWorkNoteAction` (line 317): after the gate, `if (!idSchema.safeParse(itemId).success) return invalid('Invalid item id')` and `if (!workNoteInputSchema.safeParse({ workNote }).success) return invalid('Invalid note')`.
- `updateCaseDetailsAction` (line 346): after the gate, `if (!idSchema.safeParse(id).success) return invalid('Invalid invoice id')` and `if (!caseDetailsSchema.safeParse(input).success) return invalid('Invalid case details')`.
- `updateServiceStatusAction` (line 371): after the gate, `if (!idSchema.safeParse(id).success) return invalid('Invalid invoice id')` and `if (!serviceStatusInputSchema.safeParse({ serviceStatusId }).success) return invalid('Invalid service status')`.
- `saveRecipientAction` (line 405): after the gate, `if (!idSchema.safeParse(id).success) return invalid('Invalid invoice id')` and `if (!recipientFieldsSchema.safeParse(fields).success) return invalid('Invalid recipient fields')`. Also, if `opts?.customerId` is provided, `if (opts.customerId && !idSchema.safeParse(opts.customerId).success) return invalid('Invalid customer id')`.

Note on `gateForContentEdit`: several actions gate via `gateForContentEdit(id)`, which already loads the invoice by `id`. Adding `idSchema` first turns a malformed id into a clean "Invalid invoice id" instead of a DB round-trip — harmless and strictly safer.

- [ ] **Step 6: Verify build + existing tests**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy npm run build`
Expected: PASS (compiles; no type errors from the new validation).

Run: `npm test`
Expected: PASS (unit suites unaffected).

If Docker + `supabase start` are available, also run `npm run test:integration` and expect PASS (the integration suite hits RPCs/RLS directly, not these actions, so it must be unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/data/invoice-actions.ts
git commit -m "feat(invoices): validate every server-action input via shared schemas"
```

---

## Task 4: Wire validation into customers, products, credits, billing

**Files:**
- Modify: `src/data/customer-actions.ts`, `src/data/product-actions.ts`, `src/data/credits.ts`, `src/data/billing-settings.ts`

**Interfaces:**
- Consumes: `idSchema`, `toggleActiveInputSchema`, `billingSettingsInputSchema` from `@/domain/schemas`.
- Preserves: existing return shapes and the `customerInputSchema` / `productInputSchema` / `creditInputSchema` body validation already in place.

- [ ] **Step 1: customers — validate `id` on update/archive/restore**

In `src/data/customer-actions.ts`, extend the existing `@/domain/schemas` import to add `idSchema`. In `updateCustomerAction`, `archiveCustomerAction`, and `restoreCustomerAction`, immediately after `if (gate.ok === false) return gate`, add:

```ts
  if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid clinic id' }
```

(`createCustomerAction` already fully validates via `customerInputSchema` — leave it unchanged.)

- [ ] **Step 2: products — validate `id`/`active` on update/toggle**

In `src/data/product-actions.ts`, import `idSchema, toggleActiveInputSchema`. In `updateProductAction`, after the gate: `if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid product id' }`. In `toggleProductActiveAction`, after the gate: `if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid product id' }` and `if (!toggleActiveInputSchema.safeParse({ active }).success) return { ok: false, error: 'Invalid state' }`. (`createProductAction` already validates the body.)

- [ ] **Step 3: credits — validate `customerId`**

In `src/data/credits.ts`, import `idSchema`. In `getCreditsForCustomer(customerId)` and `createCreditAction(customerId, input)`, after their permission gate (or at the top of the read), add `if (!idSchema.safeParse(customerId).success) return { ok: false, error: 'Invalid clinic id' }` — match each function's existing return shape (the read may return `[]`; if so use `if (!idSchema.safeParse(customerId).success) return []`). Verify the exact return type by reading the function before editing. (`createCreditAction` already validates its `input` via `creditInputSchema`.)

- [ ] **Step 4: billing — swap manual validator for the schema**

In `src/data/billing-settings.ts`, replace the `validateBillingSettings` import/usage with the schema. Change the import line 9–14 to also import from schemas, and replace lines 33–34:

```ts
// was: const validationError = validateBillingSettings(input); if (validationError) return fail(validationError)
const parsed = billingSettingsInputSchema.safeParse(input)
if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid billing settings')
```

Add `import { billingSettingsInputSchema } from '@/domain/schemas'`. Keep `normalizeBillingSettings(input)` on the following line (the schema validates; normalize still trims/clamps for storage). Leave `validateBillingSettings` in `src/lib/billing-settings.ts` exported (its unit tests stay green) — this task only changes the *action* to use the schema.

- [ ] **Step 5: Verify build + tests**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy npm run build`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/customer-actions.ts src/data/product-actions.ts src/data/credits.ts src/data/billing-settings.ts
git commit -m "feat(data): validate id/scalar inputs across customers, products, credits, billing"
```

---

## Task 5: Middleware redirect unit test (CI-safe login tripwire)

Locks in `updateSession()`'s auth-gating: unauthenticated GET navigations bounce to `/login`; a logged-in user on `/login` bounces to `/dashboard`; mutating (POST) requests are never redirected. Mocks `@supabase/ssr` so it runs in the plain unit gate (no DB).

**Files:**
- Test: `src/lib/supabase/middleware.test.ts`

**Interfaces:**
- Consumes: `updateSession` from `./middleware`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/middleware.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Vary the "logged-in" user per test via a module-level handle the mock reads.
let currentUser: { id: string } | null = null
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}))

import { updateSession } from './middleware'

const req = (path: string, method = 'GET') =>
  new NextRequest(new URL(`http://localhost:6060${path}`), { method })

beforeEach(() => {
  currentUser = null
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'dummy-anon-key')
})

describe('updateSession auth gating', () => {
  it('redirects an unauthenticated GET navigation to /login', async () => {
    currentUser = null
    const res = await updateSession(req('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('does not redirect an unauthenticated request already on /login', async () => {
    currentUser = null
    const res = await updateSession(req('/login'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects a logged-in user away from /login to /dashboard', async () => {
    currentUser = { id: 'u1' }
    const res = await updateSession(req('/login'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('lets a logged-in user reach a protected page', async () => {
    currentUser = { id: 'u1' }
    const res = await updateSession(req('/invoices'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('never redirects a mutating POST, even unauthenticated (server action safety)', async () => {
    currentUser = null
    const res = await updateSession(req('/invoices', 'POST'))
    expect(res.headers.get('location')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails, then passes**

Run: `npm test -- middleware`
Expected: initially may fail if `next/server`'s `NextRequest` needs a global not present — if so, the fix is to keep `environment: 'node'` (already set) and construct via `new URL(...)` as above. Once the mock resolves, expected: PASS (5 tests). If a redirect assertion is off, read `updateSession` (`src/lib/supabase/middleware.ts`) and align the expectation with the actual 307/location — do not change the middleware.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.test.ts
git commit -m "test(auth): lock in middleware login-redirect gating (CI tripwire)"
```

---

## Task 6: Deterministic seed for a real login (`supabase/seed.sql`)

The existing `config.toml` already has `[db.seed] enabled = true, sql_paths = ["./seed.sql"]` but the file is missing. Create it so `supabase db reset` yields a confirmed login user + super-admin profile + a little sample data — required by Task 7's Playwright smoke and by the staging bootstrap.

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces: login `test@lab.dev` / password `password123`, an `is_system` super-admin role, an active profile, one clinic, one product, one sent invoice.

- [ ] **Step 1: Write the seed**

Create `supabase/seed.sql`:

```sql
-- Deterministic local/staging seed. NEVER run against production.
-- Applied by `supabase db reset` (config.toml [db.seed]). Idempotent-ish: it
-- targets a fixed dev user id and ON CONFLICT DO NOTHING so re-runs are safe.

-- 1. A confirmed email/password login user (GoTrue needs encrypted_password +
--    email_confirmed_at + an identities row to authenticate).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'authenticated', 'authenticated', 'test@lab.dev',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","email":"test@lab.dev"}',
  'email', now(), now(), now()
) on conflict do nothing;

-- 2. Super-admin role (is_system => implicit all-permissions) + active profile.
insert into roles (id, name, is_system)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Owner (seed)', true)
on conflict (id) do nothing;

insert into profiles (id, username, role_id, active)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'seedowner', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true)
on conflict (id) do nothing;

-- 3. A little navigable sample data.
insert into customers (id, clinic_name, contact_person, phone, email, billing_address, delivery_address)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Seed Dental Clinic', 'Dr Seed', '0100000000',
        'clinic@seed.dev', '1 Seed St', '1 Seed St')
on conflict (id) do nothing;

insert into products (id, name, unit_price, unit)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Zirconia Crown', 250, 'tooth')
on conflict (id) do nothing;

insert into invoices (id, customer_id, created_by, due_date, subtotal, total, status)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'dddddddd-dddd-dddd-dddd-dddddddddddd', current_date + 30, 250, 250, 'sent')
on conflict (id) do nothing;
```

- [ ] **Step 2: Verify (requires Docker)**

If Docker is available:
Run: `supabase db reset`
Expected: completes; the seed applies with no error. Then `supabase status` shows the stack up. If the columns differ from the live schema (e.g. `customers` NOT NULL columns), read the relevant migration in `supabase/migrations/` and adjust the insert column list to match — the goal is a clean apply, not a specific column set.

If Docker is NOT available in this environment: mark this step **needs-owner-verify** and note it in the commit body; the SQL is written against the known schema (`profiles(id, username, role_id, active)`, `roles(id, name, is_system)`, `customers`, `products`, `invoices` per `src/integration/db.ts` seeders) but a live `supabase db reset` is the real proof.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(supabase): add deterministic local/staging seed (login user + sample data)"
```

---

## Task 7: Playwright login smoke

Real-browser proof that login works end-to-end against the seeded local stack — the high-fidelity half of the "Both" tripwire decision. Runs locally / pre-deploy, not in the plain CI gate (it needs the app + Supabase running).

**Files:**
- Create: `playwright.config.ts`, `e2e/login.smoke.spec.ts`, `e2e/helpers.ts`
- Modify: `package.json` (add `test:e2e`)

**Interfaces:**
- Consumes: the seed user from Task 6 (`test@lab.dev` / `password123`) and the dev server on port 6060.

- [ ] **Step 1: Read the login page to get real selectors**

Read `src/app/login/` (page + any client form component) and note the email input, password input, and submit button selectors. Prefer `getByLabel` / `getByRole` in the test.

- [ ] **Step 2: Add Playwright**

Run: `npm install -D @playwright/test` then `npx playwright install chromium`
Expected: dev dep added to `package.json`; Chromium downloaded.

- [ ] **Step 3: Write the config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:6060',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Reuse an already-running dev server if present; otherwise start one.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:6060/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

- [ ] **Step 4: Write helpers + smoke**

Create `e2e/helpers.ts`:

```ts
import { type Page, expect } from '@playwright/test'

export const SEED_USER = { email: 'test@lab.dev', password: 'password123' }

export async function login(page: Page, user = SEED_USER) {
  await page.goto('/login')
  // Selectors — adjust to the real login form (Step 1).
  await page.getByLabel(/email/i).fill(user.email)
  await page.getByLabel(/password/i).fill(user.password)
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|invoices|$)/)
}
```

Create `e2e/login.smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { login } from './helpers'

test('unauthenticated navigation is gated to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('a seeded user can log in and reach the app', async ({ page }) => {
  await login(page)
  await expect(page).not.toHaveURL(/\/login/)
})
```

- [ ] **Step 5: Add the script**

In `package.json` `scripts`, add: `"test:e2e": "playwright test"`.

- [ ] **Step 6: Verify (requires the stack + dev server + seed)**

Preconditions: `supabase start` up, `supabase db reset` applied (Task 6 seed present), `.env.local` pointing at the local stack.
Run: `npm run test:e2e`
Expected: both tests PASS. If a selector misses, fix `e2e/helpers.ts` against the real login form — do not change app code. If Docker/browser isn't available here, mark **needs-owner-verify** and record that in the commit body.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/ package.json package-lock.json
git commit -m "test(e2e): add Playwright login smoke against seeded stack"
```

---

## Task 8: Env matrix + docs + staging runbook

Documents the environment story and records the Phase 0 decisions. The staging Supabase project + Vercel Preview vars are an **owner action** (I write the runbook; you provision).

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/testing.md`, `docs/CONVENTIONS.md`, `.env.example`
- Create: `docs/runbooks/staging-provisioning.md`

- [ ] **Step 1: Add the env matrix to `docs/ARCHITECTURE.md`**

Append a new section "## Deployment & environment matrix" documenting the three runtime vars and where each value comes from per environment:

```markdown
## Deployment & environment matrix

The app runs on Vercel (web) against Supabase (Auth + Postgres). Three runtime
env vars, per environment:

| Var | Scope | Local (`.env.local`) | Vercel Preview | Vercel Production |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | local stack (`http://127.0.0.1:54321`) | **staging** project URL | prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | local anon key | staging anon key | prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (secret) | local service-role key | staging service-role key | prod service-role key |

Integration tests additionally read optional `SUPABASE_DB_URL` (defaults to the
local pooler `postgresql://postgres:postgres@127.0.0.1:54322/postgres`).

**Rule: Vercel Preview MUST point at the staging Supabase project, never prod
(ref `xjwkmlmkwpbxjziyngmb`).** Preview deployments run untrusted PR code; they
must not touch production data. See `docs/runbooks/staging-provisioning.md`.
```

- [ ] **Step 2: Document `SUPABASE_DB_URL` in `.env.example`**

Append to `.env.example`:

```bash

# Optional — integration tests only. Overrides the default local Supabase DB
# connection. Leave unset to use the local stack (supabase start).
# SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

- [ ] **Step 3: Write the staging runbook (owner action)**

Create `docs/runbooks/staging-provisioning.md` with numbered owner steps: (1) create a new Supabase project "chidental-lab-staging" in the same region; (2) apply all `supabase/migrations/` to it (`supabase link` + `supabase db push`, or MCP against the staging ref); (3) run `supabase/seed.sql` against staging so it has a login user + sample data; (4) in Vercel → Project → Settings → Environment Variables, set the three vars for the **Preview** scope to the staging project's URL/anon/service-role; keep **Production** scope on the prod project; (5) trigger a preview deploy from a PR and verify login works against staging. Include an explicit "do not use the prod ref for Preview" warning.

- [ ] **Step 4: Update `docs/testing.md` and `docs/CONVENTIONS.md`**

In `docs/testing.md`, add the new tiers: a middleware redirect **unit** test (runs in CI) and a Playwright **E2E** login smoke (`npm run test:e2e`, needs the stack + seed). In `docs/CONVENTIONS.md`, record three decisions: (a) CI gate = `npm test` + `npm run build` on every PR; (b) **every exported server action must `safeParse` its full input through a `src/domain/schemas.ts` schema before the first DB call** (these schemas are the future Nest DTOs); (c) Vercel Preview always points at staging Supabase, never prod.

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md docs/testing.md docs/CONVENTIONS.md .env.example docs/runbooks/staging-provisioning.md
git commit -m "docs: env matrix, staging runbook, Phase 0 conventions"
```

---

## Task 9: Phase 0 exit-criteria verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `npm test`
Expected: PASS (includes the new schema + middleware tests).

Run: `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy npm run build`
Expected: PASS.

If Docker available: `supabase start && npm run test:integration && npm run test:e2e` — all PASS.

- [ ] **Step 2: Confirm the exit criteria (from the roadmap)**

- [ ] CI green on PRs — `.github/workflows/ci.yml` present and both steps pass locally.
- [ ] All action inputs schema-validated — grep `src/data/*.ts` for exported `async function` and confirm each has a `safeParse` (or takes no user input). Re-run the Task-0 audit shape as a checklist.
- [ ] Money-path tests green — `payment-rpcs.integration.test.ts` + `money`/`billing`/`invoice-*` unit suites pass (unchanged).
- [ ] Login tripwire — middleware unit test green in CI; Playwright smoke green locally.
- [ ] Staging documented — env matrix + runbook committed. (Actual staging *provisioning* is the owner action, tracked in the runbook.)

- [ ] **Step 3: Open the PR**

```bash
git push -u origin <phase-0-branch>
gh pr create --fill --title "Phase 0 — safety net (CI, input validation, login tripwire, staging docs)"
```

---

## Notes for the executor

- **Behavior parity is the prime directive.** If wiring a schema would reject input a real call site sends today, the schema is wrong — fix the schema to match today's behavior, do not "fix" the caller. Validation tightens only against *malformed* input.
- **The two return-shape families:** `invoice-actions.ts` and `customer-actions.ts` use a LOCAL `type ActionResult = {ok:true}|{ok:false;error}`; `billing-settings.ts` uses `@/lib/action-result`'s `ActionResult<T> = {ok:true;data:T}|{ok:false;error}` with `ok()`/`fail()`. Return the shape the function already returns.
- **Docker-gated steps** (Tasks 6 Step 2, 7 Step 6): if the environment has no Docker, complete the code, mark the step needs-owner-verify in the commit body, and surface it in the final summary — do not claim they pass unverified.
- **One PR or a few small ones:** Tasks 1–5 are code and can share a branch; Tasks 6–8 (seed/e2e/docs) can be a second PR. Each task ends green independently.
