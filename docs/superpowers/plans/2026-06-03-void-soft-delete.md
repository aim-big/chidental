# Void-as-Soft-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make voiding an invoice behave as a reversible soft-delete (`voided_at`) separate from the financial `status`, so revenue/outstanding counting and un-counting are lossless one-field toggles and every report consistently ignores voided invoices.

**Architecture:** Add a `voided_at`/`voided_by`/`void_reason` triple to `invoices` and drop `'void'` from the `status` CHECK. Centralize the "what counts" rules in one pure module (`src/lib/invoice-status.ts`, unit-tested with Vitest). Void/restore become admin-only server actions mirroring the existing `employee-actions.ts` + `requireAdmin()` pattern (the codebase's real admin boundary — invoices RLS is a single permissive `authenticated_all` policy, so column-level RLS is not how this app gates admin).

**Tech Stack:** Next.js 16 (App Router) + React 19, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), TypeScript, Vitest (added here), shadcn/ui.

---

## Spec refinement note

The spec said "RLS policy." The codebase enforces admin-only mutations via **server actions gated by `requireAdmin()` + `createAdminClient()`** (see `src/lib/auth/employee-actions.ts`), because the `invoices` table has a single permissive `authenticated_all` policy. We follow the established pattern instead of introducing inconsistent column-level RLS. Same goal achieved: void/restore are a real server-side boundary, not just UI hiding.

## File structure

- **Create** `src/lib/invoice-status.ts` — pure predicates: `isVoided`, `countsAsRevenue`, `isOutstanding`.
- **Create** `src/lib/invoice-status.test.ts` — Vitest unit tests for the above.
- **Create** `vitest.config.ts` + add `test` script — minimal Vitest setup.
- **Create** `src/lib/invoices/void-actions.ts` — `'use server'` `voidInvoice` / `restoreInvoice`, admin-gated.
- **Modify** `src/lib/database.types.ts` — drop `'void'` from `InvoiceStatus`; add void fields to `Invoice`.
- **Modify** `src/lib/invoice-permissions.ts` — void-lock keys off `voided_at`, not status.
- **Modify** counting sites: `dashboard/page.tsx`, `reports/page.tsx`, `customers/[id]/page.tsx`, `work/page.tsx`.
- **Modify** `invoices/[id]/page.tsx` — soft-delete UI, void/restore actions, reason field, indicator.
- **Modify** `invoices/page.tsx` — voided filter + indicator.
- **DB migration** (via Supabase MCP `apply_migration`) — columns + CHECK constraint.

---

### Task 1: Vitest + the predicate module (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/invoice-status.test.ts`
- Create: `src/lib/invoice-status.ts`
- Modify: `package.json` (add `test` script + devDeps)

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write the failing test** — `src/lib/invoice-status.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { isVoided, countsAsRevenue, isOutstanding } from './invoice-status'

const inv = (status: string, voided_at: string | null = null) =>
  ({ status, voided_at } as any)

describe('isVoided', () => {
  it('is false when voided_at is null', () => {
    expect(isVoided(inv('paid', null))).toBe(false)
  })
  it('is true when voided_at is set', () => {
    expect(isVoided(inv('paid', '2026-06-03T00:00:00Z'))).toBe(true)
  })
})

describe('countsAsRevenue', () => {
  it('counts a paid, non-voided invoice', () => {
    expect(countsAsRevenue(inv('paid'))).toBe(true)
  })
  it('does NOT count a paid invoice that is voided', () => {
    expect(countsAsRevenue(inv('paid', '2026-06-03T00:00:00Z'))).toBe(false)
  })
  it('does NOT count a non-paid invoice', () => {
    expect(countsAsRevenue(inv('sent'))).toBe(false)
  })
})

describe('isOutstanding', () => {
  it.each(['sent', 'partial', 'overdue'])('counts %s as outstanding', (s) => {
    expect(isOutstanding(inv(s))).toBe(true)
  })
  it('excludes a voided outstanding invoice', () => {
    expect(isOutstanding(inv('sent', '2026-06-03T00:00:00Z'))).toBe(false)
  })
  it('excludes draft and paid', () => {
    expect(isOutstanding(inv('draft'))).toBe(false)
    expect(isOutstanding(inv('paid'))).toBe(false)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./invoice-status` (module not created yet).

- [ ] **Step 6: Implement `src/lib/invoice-status.ts`**

```ts
import type { Invoice } from '@/lib/database.types'

type VoidFields = Pick<Invoice, 'voided_at'>
type CountFields = Pick<Invoice, 'voided_at' | 'status'>

const OUTSTANDING_STATUSES = ['sent', 'partial', 'overdue'] as const

/** An invoice is voided (soft-deleted/cancelled) when voided_at is set. */
export const isVoided = (inv: VoidFields): boolean => inv.voided_at != null

/** Counts toward recognized revenue: paid and not voided. */
export const countsAsRevenue = (inv: CountFields): boolean =>
  !isVoided(inv) && inv.status === 'paid'

/** Owed money: sent/partial/overdue and not voided. */
export const isOutstanding = (inv: CountFields): boolean =>
  !isVoided(inv) && (OUTSTANDING_STATUSES as readonly string[]).includes(inv.status)
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/invoice-status.ts src/lib/invoice-status.test.ts
git commit -m "feat: add invoice-status predicate module with vitest"
```

---

### Task 2: DB migration + types

**Files:**
- DB migration (Supabase MCP `apply_migration`, name `void_soft_delete`)
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Apply the migration**

Use `apply_migration` with name `void_soft_delete` and SQL:
```sql
alter table public.invoices
  add column if not exists voided_at  timestamptz,
  add column if not exists voided_by  uuid references auth.users(id),
  add column if not exists void_reason text;

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status = any (array['draft','sent','partial','paid','overdue']::text[]));
```

- [ ] **Step 2: Verify in DB**

Run via `execute_sql`:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='invoices'
  and column_name in ('voided_at','voided_by','void_reason');
```
Expected: three rows.

- [ ] **Step 3: Update `InvoiceStatus` in `src/lib/database.types.ts`**

Change line 1 from:
```ts
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void'
```
to:
```ts
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'
```

- [ ] **Step 4: Add void fields to the `Invoice` interface**

In `src/lib/database.types.ts`, in `interface Invoice`, add after `status: InvoiceStatus` (line 56):
```ts
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat: add void soft-delete columns; drop void from status enum"
```

---

### Task 3: Update `invoice-permissions.ts`

**Files:**
- Modify: `src/lib/invoice-permissions.ts`

- [ ] **Step 1: Replace `canEditInvoice` to key the void-lock off `voided_at`**

Replace the whole file body (the function) with:
```ts
import type { Invoice } from '@/lib/database.types'
import { isVoided } from '@/lib/invoice-status'

/**
 * Whether an invoice's content (header fields, line items, recipient,
 * patient/doctor) may be edited.
 *
 * Rules:
 * - Voided (soft-deleted) is terminal — locked for everyone.
 * - `draft` is editable by anyone (staff or admin).
 * - Once sent (`sent`/`partial`/`paid`/`overdue`) only an admin may edit.
 *
 * UI gating only for now; not a security boundary.
 */
export function canEditInvoice(inv: Pick<Invoice, 'status' | 'voided_at'>, role: string): boolean {
  if (isVoided(inv)) return false
  return inv.status === 'draft' || role === 'admin'
}
```

- [ ] **Step 2: Typecheck (caller updated in Task 6, expected to error until then)**

Run: `npx tsc --noEmit`
Expected: the only new error is in `invoices/[id]/page.tsx` at the `canEditInvoice(invoice.status, role)` call (fixed in Task 6). Note it and continue.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invoice-permissions.ts
git commit -m "refactor: canEditInvoice locks on voided_at, not status"
```

---

### Task 4: Void/restore server actions

**Files:**
- Create: `src/lib/invoices/void-actions.ts`

- [ ] **Step 1: Create the actions**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/require-admin'

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function voidInvoice(input: { id: string; reason?: string }): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return gate

  const admin = createAdminClient()
  const { error } = await admin
    .from('invoices')
    .update({
      voided_at: new Date().toISOString(),
      voided_by: gate.userId,
      void_reason: input.reason?.trim() || null,
    })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/invoices/${input.id}`)
  revalidatePath('/invoices')
  return { ok: true }
}

export async function restoreInvoice(input: { id: string }): Promise<ActionResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return gate

  const admin = createAdminClient()
  const { error } = await admin
    .from('invoices')
    .update({ voided_at: null, voided_by: null, void_reason: null })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/invoices/${input.id}`)
  revalidatePath('/invoices')
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invoices/void-actions.ts
git commit -m "feat: admin-only void/restore server actions"
```

---

### Task 5: Wire counting sites to the predicate module

**Files:**
- Modify: `src/app/(authenticated)/dashboard/page.tsx`
- Modify: `src/app/(authenticated)/reports/page.tsx`
- Modify: `src/app/(authenticated)/customers/[id]/page.tsx`
- Modify: `src/app/(authenticated)/work/page.tsx`

- [ ] **Step 1: Dashboard** — import helper and use it; select `voided_at`.

Add import near other `@/lib` imports:
```ts
import { countsAsRevenue, isOutstanding } from '@/lib/invoice-status'
```
Change the query (line 36) from `select('total, status, due_date')` to:
```ts
        supabase.from('invoices').select('total, status, due_date, voided_at'),
```
Replace the revenue/outstanding filters (lines 46-51) with:
```ts
      const revenue = invoices
        .filter(i => countsAsRevenue(i) && i.due_date >= firstOfMonth)
        .reduce((s, i) => s + Number(i.total), 0)
      const outstanding = invoices
        .filter(i => isOutstanding(i))
        .reduce((s, i) => s + Number(i.total), 0)
```

- [ ] **Step 2: Reports** — import + use; `select('*')` already includes `voided_at`.

Add import:
```ts
import { countsAsRevenue, isOutstanding } from '@/lib/invoice-status'
```
Replace lines 43-46:
```ts
  const totalPaidInvoices = invoices.filter(i => countsAsRevenue(i)).reduce((s, i) => s + Number(i.total), 0)
  const totalOutstanding = invoices
    .filter(i => isOutstanding(i))
    .reduce((s, i) => s + Number(i.total), 0)
```
Replace the outstanding-with-aging filter (line 51) `.filter(i => ['sent', 'partial', 'overdue'].includes(i.status))` with:
```ts
    .filter(i => isOutstanding(i))
```

- [ ] **Step 3: Customer detail** — import + use; `select('*')` already includes `voided_at`.

Add import:
```ts
import { isOutstanding } from '@/lib/invoice-status'
```
Replace lines 43-45:
```ts
  const totalOutstanding = invoices
    .filter(i => isOutstanding(i))
    .reduce((s, i) => s + Number(i.total), 0)
```

- [ ] **Step 4: Work page** — exclude voided via `voided_at`.

Change the select (line 72) to include `voided_at`:
```ts
      .select('id, description, work_status, work_status_updated_at, invoices(id, invoice_number, status, voided_at, customers(clinic_name))')
```
Change the filter (line 75) from `r.invoices.status !== 'void'` to:
```ts
    const items = ((data ?? []) as unknown as Row[]).filter(r => r.invoices && r.invoices.voided_at == null)
```
If `Row`'s `invoices` type is declared inline, add `voided_at: string | null` to it (search the top of the file for the `Row`/`invoices` type and add the field).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from these four files.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(authenticated)/dashboard/page.tsx" "src/app/(authenticated)/reports/page.tsx" "src/app/(authenticated)/customers/[id]/page.tsx" "src/app/(authenticated)/work/page.tsx"
git commit -m "feat: exclude voided invoices from all revenue/outstanding/work counts"
```

---

### Task 6: Invoice detail page — soft-delete UI + void/restore

**Files:**
- Modify: `src/app/(authenticated)/invoices/[id]/page.tsx`

- [ ] **Step 1: Imports + remove `void` from STATUS_VARIANT**

Add imports:
```ts
import { isVoided } from '@/lib/invoice-status'
import { voidInvoice as voidInvoiceAction, restoreInvoice } from '@/lib/invoices/void-actions'
```
Remove `void: 'secondary',` from the `STATUS_VARIANT` map (line 32).

- [ ] **Step 2: Add reason + restoring state**

Near the `voidOpen`/`voiding` state (lines 90-91), add:
```ts
  const [voidReason, setVoidReason] = useState('')
  const [restoring, setRestoring] = useState(false)
```

- [ ] **Step 3: Replace `voidInvoice`, add `restore`**

Replace the `voidInvoice` function (lines 211-218) with:
```ts
  const voidInvoice = async () => {
    if (!invoice) return
    setVoiding(true)
    const res = await voidInvoiceAction({ id: invoice.id, reason: voidReason })
    setVoiding(false)
    setVoidOpen(false)
    setVoidReason('')
    if (!res.ok) { alert(res.error); return }
    load()
  }

  const restore = async () => {
    if (!invoice) return
    setRestoring(true)
    const res = await restoreInvoice({ id: invoice.id })
    setRestoring(false)
    if (!res.ok) { alert(res.error); return }
    load()
  }
```

- [ ] **Step 4: Compute `voided` and fix `canEdit`**

Replace line 565:
```ts
  const voided = isVoided(invoice)
  const canEdit = canEditInvoice(invoice, role)
```
(`canEditInvoice` already returns false when voided, per Task 3.)

- [ ] **Step 5: Watermark keys off `voided`**

Line 368: change `{invoice.status === 'void' && (` to `{voided && (`.

- [ ] **Step 6: Status badge area — add Voided indicator**

Replace the badge block (lines 578-586) with:
```ts
              <Badge variant={STATUS_VARIANT[invoice.status] ?? 'secondary'} className="capitalize">{invoice.status}</Badge>
              {voided && (
                <Badge variant="destructive" className="uppercase">Voided</Badge>
              )}
              {!voided && !canEdit && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-gray-500"
                  title="This invoice has been sent. Only an admin can edit it."
                >
                  <Lock className="h-3 w-3" />Locked
                </span>
              )}
```

- [ ] **Step 7: Action bar — gate workflow actions on `!voided`, swap Void button for admin Void/Restore**

The Mark-as-Sent / Record-Payment / Mark-Paid blocks must not show on a voided invoice. Change their conditions:
- Line 594: `{invoice.status === 'draft' && (` → `{!voided && invoice.status === 'draft' && (`
- Line 597: `{['sent', 'partial', 'overdue'].includes(invoice.status) && (` → `{!voided && ['sent', 'partial', 'overdue'].includes(invoice.status) && (`

Replace the Void button block (lines 620-629) with admin-only Void (active) / Restore (voided):
```ts
          {isAdmin && !voided && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => setVoidOpen(true)}
            >
              <Ban className="h-4 w-4 mr-2" />Void
            </Button>
          )}
          {isAdmin && voided && (
            <Button variant="outline" size="sm" onClick={restore} disabled={restoring}>
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          )}
```
Add `isAdmin` to the `useAuth()` destructure at line 72: `const { user, role, isAdmin } = useAuth()`.

- [ ] **Step 8: Hidden-when-void sections key off `voided`**

Replace `{invoice.status !== 'void' && (` at lines 639, 676, and `{invoice.status !== 'void' && items.length > 0 && (` at line 719:
- 639 → `{!voided && (`
- 676 → `{!voided && (`
- 719 → `{!voided && items.length > 0 && (`

- [ ] **Step 9: Void dialog — add reason field, fix copy**

In the void dialog (lines 1132-1151): change the description paragraph copy (line 1140-1142) and add a reason input before `DialogFooter`:
```tsx
          <p className="text-sm text-gray-600">
            Void <span className="font-semibold">{invoice?.invoice_number}</span>? It will be excluded
            from revenue and reports. You can restore it later.
          </p>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="e.g. duplicate, entry error" />
          </div>
```
(Confirm `Label` and `Input` are already imported in this file — they are used elsewhere in the page.)

- [ ] **Step 10: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean — no type errors, build succeeds.

- [ ] **Step 11: Commit**

```bash
git add "src/app/(authenticated)/invoices/[id]/page.tsx"
git commit -m "feat: invoice detail void/restore UI via soft-delete + admin gating"
```

---

### Task 7: Invoices list page — voided filter + indicator

**Files:**
- Modify: `src/app/(authenticated)/invoices/page.tsx`

- [ ] **Step 1: Import predicate; ensure `voided_at` is fetched**

Add import:
```ts
import { isVoided } from '@/lib/invoice-status'
```
The list query uses `select('*, ...)` (line 46), so `voided_at` is already returned. Confirm the local row type (search for the `type`/`interface` with `status`) includes `voided_at: string | null`; add it if the type is explicit.

- [ ] **Step 2: Remove `void` from STATUS_VARIANT and replace the filter option**

Remove `void: 'secondary',` from `STATUS_VARIANT` (line 26).
Change the status filter so "Voided" filters on `voided_at`. Replace the filter predicate (line 62) `const matchStatus = statusFilter === 'all' || inv.status === statusFilter` with:
```ts
        const matchStatus =
          statusFilter === 'all' ? true :
          statusFilter === 'void' ? isVoided(inv) :
          (!isVoided(inv) && inv.status === statusFilter)
```
Keep the `<SelectItem value="void">Void</SelectItem>` (line 99) — it now means "voided".

- [ ] **Step 3: Row badge — show Voided indicator**

Replace the badge (line 146) with:
```tsx
                      {isVoided(inv)
                        ? <Badge variant="destructive" className="uppercase">Voided</Badge>
                        : <Badge variant={STATUS_VARIANT[inv.status] ?? 'secondary'} className="capitalize">{inv.status}</Badge>}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/invoices/page.tsx"
git commit -m "feat: invoices list voided filter + indicator"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full check**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tests pass, no type errors, lint clean, build succeeds.

- [ ] **Step 2: Grep for stragglers**

Run: `grep -rn "'void'\|\"void\"\|status === 'void'\|status !== 'void'" src/app src/components src/lib`
Expected: no remaining invoice `status` comparisons to `'void'` (the only `void` matches should be the list filter value `"void"` meaning "voided", and unrelated JS `void` if any).

- [ ] **Step 3: Manual smoke (dev server)**

Run `npm run dev`. As an admin: open a sent invoice → Void with a reason → confirm VOID watermark, "Voided" badge, workflow buttons hidden, Restore button present; check it disappears from dashboard outstanding and the work page; Restore → confirm it returns to its prior status everywhere. As a non-admin (or with `isAdmin` false): confirm no Void/Restore buttons.

---

## Self-review

- **Spec coverage:** data model (Task 2), predicate module (Task 1), all counting sites incl. payments rule [no current payment sums; predicate enforces forward-looking] (Task 5), permissions file (Task 3), void/restore admin actions (Task 4), detail UI incl. watermark/badge/reason/restore (Task 6), list filter/indicator (Task 7), verification (Task 8). Covered.
- **Placeholders:** none — all steps contain concrete code/commands.
- **Type consistency:** `isVoided`/`countsAsRevenue`/`isOutstanding` signatures used consistently; `canEditInvoice(inv, role)` new signature matched at its only caller (Task 6 Step 4); `voidInvoice`/`restoreInvoice` action names aliased in the detail page to avoid clashing with the local `voidInvoice` handler.
