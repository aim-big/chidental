# NestJS Migration — Progress Tracker

> Live status of the Next.js → NestJS **strangler** migration. Master plan:
> [`docs/superpowers/plans/2026-07-09-nestjs-migration-roadmap.md`](superpowers/plans/2026-07-09-nestjs-migration-roadmap.md).
> Update this file in the same PR that changes status. **Last updated: 2026-07-09.**

## At a glance

**The migration is CODE-COMPLETE.** All 9 data modules (6 reads + 3 writes) run on
the NestJS API behind per-module flags, each verified end-to-end. Every module is
**inert by default** (flags off) — Next.js still serves 100% of production until
you flip a flag. What remains is **owner-run**: roll the flags out in prod one at
a time with a soak between each (see the Rollout runbook below), then the
post-soak code tidy.

```
Foundation      ██████████████████████████  100%   phases 0–2 + shared + keystone
Read modules    ██████████████████████████  100%   6 of 6 ✅
Write modules   ██████████████████████████  100%   3 of 3 ✅
Prod rollout    ░░░░░░░░░░░░░░░░░░░░░░░░░░    0%   👤 owner — flag-flip + soak
Post-soak tidy  ░░░░░░░░░░░░░░░░░░░░░░░░░░    0%   after every module has soaked
```

**All 9 data modules migrated + E2E-verified (PRs #6, #7, #9, #11–#16).** The API
serves zero production traffic until an owner flips a flag.

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Done + merged to `main` |
| 🟡 | In progress / open PR |
| ⬜ | Not started |
| 🔒 | Blocked (dependency not yet met) |
| 👤 | **Owner action** — a prod flag-flip + soak I can't do for you |

## Phases

| Phase | Scope | Status | PR |
|-------|-------|--------|----|
| 0 | Safety net (CI, input validation, login tripwire, seed) | ✅ | #2 |
| 1 | Monorepo restructure → `apps/web` (**live in prod**) | ✅ | #3 |
| 2 | NestJS `apps/api` (auth guard, health) — **deployed to Railway, inert** | ✅ | #4 |
| 3-prep | `@chidental/shared` extraction | ✅ | #5 |
| **Keystone** | **API consumes `@chidental/shared` at runtime** (dual `exports` build) | ✅ | #10 |
| 3 | Per-module strangler migration (reads → writes) | 🟡 | see below |
| 4 | Cleanup — remove flags, scope keys, docs | ⬜ | — |

## Module-by-module (Phase 3)

Each module: build the API endpoint(s) mirroring `apps/web/src/data/<m>.ts`, add the
`isModuleOnApi('<m>')` seam branch, verify, merge. Then **you** flip `USE_API_MODULES`
in Vercel per module and soak ≥1 week. Flag OFF by default = zero behavior change.

### Reads (no data mutation — lower risk)

| # | Module | Status | PR | Needs | Verified |
|---|--------|--------|----|-------|----------|
| 1 | products | ✅ | #6 | types only | E2E browser + curl |
| 2 | customers | ✅ | #7 | types only | E2E curl (incl. 404→null, 401) |
| 3 | work | ✅ | #9 | types only | E2E curl |
| 4 | invoices (read) | ✅ | #11 | types only (`isVoided`/`paginate` inlined) | E2E curl — 7 endpoints incl. sort, counts, 404, 401 |
| 5 | dashboard | ✅ | #13 | types only (queries + date math + normalize) | E2E curl — bundle shape, payment/work normalize, 401 |
| 6 | reports | ✅ | #13 | types only (queries + to-one normalize) | E2E curl — invoices + payments (flattened), 401 |

### Writes (data mutation — money / audit critical, **invoices last**)

The **write seam** (`apiSend` in `apps/web/src/lib/api/client.ts`): POST/PATCH/DELETE a JSON body; the controller returns the `ActionResult` as a **200/201 body** for validation + DB outcomes (messages verbatim), and the guard status-codes auth/permission (401/403) which `apiSend` maps back to the exact `requirePermission` strings. `revalidatePath` stays in the web action. Each write endpoint carries `@RequirePermission(key)` — the API enforces the gate itself (it's public; can't trust the web gate).

| # | Module | Status | PR | Needs | Notes |
|---|--------|--------|----|-------|-------|
| 7 | customer-actions | ✅ | #14 | shared Zod DTOs at runtime (✅ keystone) | create/update/archive/restore — E2E mutation-verified + cleanup |
| 8 | work-actions (status/note) | ✅ | #15 | user-scoped client + activity log | E2E: history `changed_by`=real actor (not null), on_hold round-trip, note+activity |
| 9 | invoice-actions | ✅ | #16 | billing-snapshot + diff/labels ported; RPCs take actor param | create/issue/pay/case/recipient/update — E2E money + audit-trail verified |

**Write infra built (reused by module 9):** `SupabaseService.forUser(token)` (user-scoped client so trigger `auth.uid()` records the real actor), `@Auth()`/`@AccessToken()` param decorators, `AuthContext.actorName`, global `ActivityLogService.logInvoiceActivity` (mirrors `@/lib/audit/audit-log`).

## Prerequisite work items

| Item | Status | Unblocks |
|------|--------|----------|
| **Reconcile duplicate status logic** → single `@chidental/shared` `domain/invoice-status` kernel; web `@/lib/invoice-status` is now a re-export shim; `billing.ts` keeps only `canTransition`. Behavior-neutral (`due_date` is `NOT NULL`, so the two `isOverdue`s were identical). | ✅ #12 | landmine removed; unblocks write-side money logic |
| Port audit (`ActivityLogService`), billing-snapshot, diff/labels to API; `forUser` client for trigger `auth.uid()` | ✅ #15/#16 | work + invoice writes |

> Note: dashboard/reports reads turned out **types-only** — `getDashboardData`/`getReport*` return raw rows; the aggregation (`@/lib/dashboard`, `@/lib/reports`) runs in the page and stays in web. The API mirrors the queries + normalization only.

## 👤 Rollout runbook (owner-run — not codeable)

The code is done; putting the API into production is a controlled, reversible
rollout **you** drive. Nothing here is automatic.

**One-time setup**
1. In Vercel (project `chidental-lab`), set `NEXT_PUBLIC_API_URL=https://chidental-api-production.up.railway.app` (Production).
2. Confirm the Railway API is healthy: `GET /health` → `{"status":"ok","shared":true}`. (`shared:true` proves the API's shared runtime link is intact.)
3. Leave `USE_API_MODULES` **empty** — everything still runs on Next.

**Per-module cutover — repeat for each, in this order (lowest blast radius first):**

> `products → customers → work → dashboard → reports → invoices → customer-actions → work-actions → invoice-actions`

For module `M`:
1. **Append** `M` to `USE_API_MODULES` in Vercel Production (comma-separated) → redeploy.
2. **Smoke test** that module's page(s) in prod: it should render/behave identically (it's calling the API now).
3. **Soak ≥1 week.** Watch Railway logs + Vercel runtime errors + latency. For write modules, spot-check the audit trail (invoice activity / status history) shows the right actor.
4. **Rollback (instant):** remove `M` from `USE_API_MODULES` → redeploy. The Next path is untouched and resumes immediately — no data migration, no risk.
5. Only after a clean soak, move to the next module.

**Notes**
- **Reads lead writes.** Roll out a module's read flag and soak it before its write flag (`customers` before `customer-actions`, `invoices`+`work` before `invoice-actions`/`work-actions`).
- **`invoice-actions` is last** — it's the money + audit path.
- Also wire **Railway ↔ GitHub auto-deploy** (currently a manual `railway up` / build-on-push) so API changes ship automatically.

## Post-soak code tidy (only after ALL modules have soaked in prod)

Deferred on purpose — these delete the safety net, so they must wait until the API
is proven in prod for every module:
- Remove the `isModuleOnApi(...)` branches + the now-dead local Next query/action paths from `apps/web/src/data/*`.
- Retire the `apps/web/src/lib/invoice-status.ts` re-export shim (import from `@chidental/shared` directly at the ~13 call sites).
- Scope the API's Supabase key down from full service-role where feasible.
- Remove `USE_API_MODULES` / `isModuleOnApi` once every module is API-only.

## Key facts

- **API base:** `https://chidental-api-production.up.railway.app` (serves **zero** prod traffic until a flag flips).
- **Flag:** `USE_API_MODULES` (comma list) + `NEXT_PUBLIC_API_URL`, read via `isModuleOnApi()` in `apps/web/src/lib/config.ts`.
- **Behaviour-preservation invariant:** the API uses a service-role client (bypasses RLS); this is safe **only** where every touched table's read policy is `using (true)`. Verify per module before migrating.
- **Gates:** `npm test` (shared/web/api) + `npm run build` (web/api). tsc/lint are unusable in this repo.
