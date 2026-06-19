# Plan 5 — Customers module, server-first

**Date:** 2026-06-19
**Status:** Done (Tasks 1–5) — automated verification green (tsc 0 errors, lint clean,
94 tests pass); live browser smoke pending. The customers module no longer imports
the browser Supabase singleton.
**Depends on:** Plan 1 (feedback primitives), Plan 3 (invoices data-layer template), Spec 5 (permission-enforcing RLS)

## Goal

Bring the **Customers** module onto the same architecture invoices/work already use:
all Supabase access behind `src/data/*`, reads in Server Components, writes as
permission-gated Server Actions returning `ActionResult`, errors surfaced via the
global toast. Behavior-preserving — same queries, same fields, same gating rule
(`customers.edit`).

## Why customers first

- Smallest core CRUD; `new`/`edit` routes already exist (thin wrappers).
- It is currently the clearest remaining instance of the old pattern: list +
  detail are `'use client'` reading the browser singleton, and the form writes
  directly via `supabase.from('customers').insert/update`.
- Establishes the reusable read+write+detail template the rest of the modules
  (Products, Reports/Dashboard, Settings) will copy.

## Current state (what's wrong)

| File | Problem |
|---|---|
| `customers/page.tsx` | `'use client'`, `useEffect` read of `supabase`, client `useMemo` search |
| `customers/[id]/page.tsx` | `'use client'`, parallel client reads, totals derived in render |
| `components/customers/CustomerForm.tsx` | `'use client'` direct `insert`/`update`; errors only in local state (no toast); edit-mode reads via browser singleton |
| `customers/new`, `customers/[id]/edit` | "server" only by absence of `'use client'`; render the client form |
| `domain/schemas.ts` `customerInputSchema` | incomplete — missing `ssm_no`, addresses, `notes` |

## Tasks

### Task 1 — Data layer
- Extend `customerInputSchema` (domain/schemas.ts) to all writable fields
  (`clinic_name, ssm_no, contact_person, phone, email, billing_address,
  delivery_address, notes`); export `CustomerInput`. Add `domain/schemas.test.ts`
  cases.
- `src/data/customers.ts` (reads, SSR client): `getCustomers()`,
  `getCustomerDetail(id)` (customer + its invoices), `getCustomerForEdit(id)`.
- `src/data/customer-actions.ts` (`'use server'`): `createCustomerAction`,
  `updateCustomerAction` — `requirePermission('customers.edit')`, admin client,
  zod-validate, `revalidatePath('/customers')` (+ detail path on update), return
  `ActionResult` / `CreateResult`.
- Pure helper `summarizeCustomerInvoices(invoices)` in `domain/aggregation.ts`
  (totalBilled / totalOutstanding via existing `isVoided`/`isOutstanding`) + test.

### Task 2 — List page
- `customers/page.tsx` → Server Component: `const customers = await getCustomers()`.
- New `components/customers/CustomerListClient.tsx` island: search box +
  `useMemo` filter (verbatim from today), `useAuth().hasPermission('customers.edit')`
  to gate the New button, row → `/customers/[id]`.

### Task 3 — Detail page
- `customers/[id]/page.tsx` → Server Component: `getCustomerDetail(id)`,
  `notFound()` when missing, totals via `summarizeCustomerInvoices`.
- Keep interactivity minimal (Links for nav; a tiny client wrapper only if a
  row `onClick` is needed). Edit/New buttons gated by a server permission read.

### Task 4 — Form
- `CustomerForm` keeps RHF client UX but submits via `create/updateCustomerAction`;
  success/error via toast; on success `router.push('/customers')` (or detail).
- Edit page passes `initialData` from `getCustomerForEdit(id)` as a prop — no more
  browser-singleton read inside the form.
- Drop `import { supabase } from '@/lib/supabase'` from the customers module.

### Task 5 — Verify
- `npx tsc --noEmit`, `npm test`, `npm run lint` all clean.
- Manual smoke: list search, open detail, create, edit, permission-gated New
  button, error toast on a forced failure.

## Out of scope
- Customer delete (none exists today).
- Pagination / server-side search (defer; keep client `useMemo` search).
- The Settings IA / route-registry work (owner handling separately).
