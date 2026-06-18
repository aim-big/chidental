# Spec 1 — Foundation + Invoices + Work Status

**Date:** 2026-06-18
**Status:** Draft for review
**Author:** Tech lead (design session)

---

## 1. Why

The app works but was built screen-by-screen ("lego"): every page calls `supabase.from(...)` directly and holds its own copy of data in `useState`, so nothing shares anything and modules drift apart. The invoice detail and the work queue fetch the *same* items twice and never tell each other when one changes. There is no layer that defines "how you read/write an invoice."

This spec establishes a **shared foundation** and proves it by rebuilding the two highest-value, hardest modules — **invoices** and **work status** — on top of it. The app stays runnable and launchable throughout (incremental, refactor-in-place).

**Root-cause fix:** introduce one place that owns DB access, make data flow server-first per Next.js convention, and connect modules through revalidation instead of duplicated fetches.

## 2. Goals & non-goals

**Goals**
- A server-first data foundation (Server Components for reads, Server Actions for writes) that is the *only* place touching Supabase.
- Invoices and work status rebuilt on it, visibly connected and always consistent.
- Billing and production lifecycles modeled as explicit state machines.
- Launchable at the end of this spec.

**Non-goals (explicitly deferred)**
- **Security hardening / authorization enforcement** — RLS stays permissive for now; we build the *seam* (server actions) where enforcement will later land (Spec 5).
- Rebuilding Customers, Products, Reports, Dashboard, Settings — they keep working as-is and migrate in later specs.

## 3. Decomposition (build cycles)

| Spec | Scope |
|---|---|
| **1 (this)** | Foundation + Invoices + Work Status |
| 2 | Migrate Customers + Products onto the foundation |
| 3 | Reports + Dashboard |
| 4 | Settings / RBAC polish |
| 5 | Security hardening (authorization enforcement) |

Each later module is cheap because the foundation already exists.

## 4. Foundation architecture

### 4.1 Target structure
```
src/
  data/      # the ONLY Supabase callers. Server-side query fns + Server Actions, one module per aggregate
  domain/    # pure rules: billing + production state machines, money, permissions, Zod schemas. Unit-tested.
  hooks/     # client hooks ONLY where interactivity needs them (escape hatch)
  components/ # ui/ primitives + <feature>/ pieces. Thin, focused, composable.
  app/       # routes. Server Components that fetch via data/ and compose components. Thin.
  lib/supabase/ # the three clients (unchanged)
```

### 4.2 Data flow (server-first, Next.js convention)
- **Reads → Server Components.** Pages are server components that call `data/<aggregate>` query functions using the server Supabase client (RLS via cookies). No data layer ships to the browser; queries run server-side.
- **Writes → Server Actions.** Every mutation is a `'use server'` action in `data/`. This is the single write seam and the future home of `requirePermission(...)` (Spec 5). For now actions call Supabase directly.
- **Cohesion → tag-based revalidation.** Actions call `revalidateTag(...)` (e.g. `invoice-<id>`, `work-queue`, `dashboard`, `reports`). Any server-rendered view depending on that tag refreshes automatically — the server-side equivalent of cache invalidation, and the mechanism that keeps modules "linked."
- **Interactivity → Client Components only where needed.** The work-queue board uses React 19 `useOptimistic` + a server action (optimistic move with real rollback on failure). Forms submit through actions.
- **No React Query by default** — only as an escape hatch if a screen genuinely needs cross-navigation client caching. Not expected in this spec.

### 4.3 Domain layer
- Port the existing tested helpers (`invoice-status`, `work-status`, `work-stages`, `permissions`, money) into `src/domain/`, promoted to first-class.
- Two explicit **state machines** (see §5, §6) with documented allowed transitions.
- **Zod schemas live here and are shared** by client forms and server actions — the server validates too, not just the browser.
- Pure and unit-tested; pages and components hold zero business logic.

### 4.4 Cross-cutting foundation pieces
- **Global feedback:** a toast provider + an error boundary + one standard action-result shape. Failed mutations are never silent.
- **Atomicity:** all multi-row writes go through transactional Postgres RPCs (extend the existing `create/update_invoice_with_items` pattern).
- **Schema versioning:** capture all existing DB functions, triggers, and policies into migration files as the baseline — the foundation is not "founded" while DB logic lives only on the server.
- **Tailwind v4:** migrate from v3 early, before rebuilding module UIs (avoids double work; shadcn supports v4; tokens centralized via `@theme`).
- **TypeScript strict:** enable `strict` and remove `as unknown as` casts (the typed data layer makes this natural).
- **Component discipline:** thin pages; break large screens into focused components (the ~1290-line invoice detail becomes header / line-items / payments / work / print-dialog pieces). A file growing large is a signal it does too much.

## 5. Invoices

An invoice has **two independent lifecycles**; both become first-class.

### 5.1 Billing lifecycle (money)
- States: `draft → sent → partial → paid`; `void` is an overlay (soft delete); `overdue` is **derived** (`isOutstanding && due_date < today`), never stored.
- Transitions live in one **billing state machine** in `domain/`. No scattered `.update({status})`.
- `invoices.status` becomes a **real Postgres enum (or CHECK constraint)** — today it is free text, so the DB cannot guarantee a valid value.

### 5.2 Money is single source of truth
- "Mark Paid" **creates a balancing payment row** for the outstanding amount, so `sum(payments)` always reconciles with `status` and every report agrees.
- Recording a payment and the resulting status change happen in **one atomic RPC** (no more insert-then-separately-update window).

### 5.3 UI rebuild
- List: server-fetched, paginated, column-scoped query; filters via URL search params.
- Detail: decomposed into focused components; reads server-side; all actions are server actions with revalidation.
- Form (create/edit): interactive line-item editor (client) submitting through the atomic create/update actions; Zod validation shared with the server; product price-band still enforced by DB trigger.

## 6. Work status & the invoice ↔ work link (core integration)

### 6.1 Production lifecycle (per item)
- States: `received → in_progress(stage) → ready → delivered`; `on_hold` is an overlay.
- **`on_hold` gets a modeled return path** — entering on_hold remembers the prior state so the item can resume (today there is no way out via the helpers). Implementation: track prior status (e.g. a column or history-derived) so "resume" returns to it.
- The `in_progress` phase is subdivided by configurable `work_stages`; encode/decode of `(work_status, stage_id)` stays, ported into `domain/`.
- Production transitions live in a **production state machine** in `domain/`.

### 6.2 The link
- An invoice gets a **derived production status** = a single aggregation rule over its items (`dominantWorkStatus`), defined once in `domain/` and used everywhere (list, detail, work queue, dashboard) — no ad-hoc re-derivation.
- The invoice detail and the work queue read/write the **same item records through the same data layer**; a work-status change revalidates `invoice-<id>` **and** `work-queue`, so both views stay consistent automatically.
- Navigation links both ways (invoice → its items in the queue; queue item → its invoice).
- Billing and production stay **independent** (delivering work does not mark it paid) but are **visibly connected and always consistent**.

### 6.3 Work queue UI
- Board grouped by stage; moves use `useOptimistic` + a server action with **rollback + error toast** on failure.
- Items on voided invoices excluded; items on retired stages still render (ported behavior).

## 7. Data model changes
1. `invoices.status` → enum/CHECK (`draft|sent|partial|paid|overdue`).
2. `on_hold` resume support (store prior production status).
3. "Mark Paid" → balancing payment row, via an atomic RPC; payment+status atomic RPC.
4. Capture existing functions/triggers/policies into versioned migrations (baseline).
5. (No destructive changes; all additive/forward-compatible.)

## 8. Testing strategy
- Keep/extend domain **unit tests** (state machines, money, aggregation).
- Add **integration/E2E** for the three flows that cannot break at launch: create invoice (atomic), record payment (creates payment + status, atomic), advance work status (queue + detail stay in sync).
- Manual smoke via the running app (login `admin`) for each rebuilt screen.

## 9. Documentation (per-module deliverable)
Written as each piece lands, indexed by `docs/ARCHITECTURE.md`:
- `docs/modules/data-model.md`, `billing-lifecycle.md` (with state diagram), `work-status.md` (with state diagram), `permissions.md`.

## 10. Build order (for the implementation plan)
1. **Foundation prep:** capture DB schema into migrations; scaffold `data/` + `domain/`; Tailwind v4; toast + error boundary; enable strict TS.
2. **Domain:** billing + production state machines, money rules, Zod schemas (port + harden existing `lib/`).
3. **Data + DB:** status enum migration; payment-on-mark-paid + atomic payment/status RPCs; on_hold resume; `data/` query fns + server actions with tag revalidation for invoices/items/payments.
4. **Invoices module** rebuilt server-first (list, decomposed detail, form via actions).
5. **Work-status module** rebuilt (queue with `useOptimistic`, derived production status, the invoice↔work link).
6. **Tests + docs.**

## 11. Success criteria
- No component calls `supabase.from(...)` directly — all DB access is in `data/`.
- Reads are server-first; writes are server actions; views stay in sync via revalidation.
- `invoices.status` is enum-constrained; `sum(payments)` always reconciles with a `paid` invoice.
- Work-queue and invoice detail reflect each other's changes without a manual refresh.
- Domain unit tests + the three E2E flows pass; module docs written.
- App builds, lints, and the priority flows work end-to-end logged in as `admin`.
