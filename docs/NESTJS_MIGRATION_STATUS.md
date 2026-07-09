# NestJS Migration — Progress Tracker

> Live status of the Next.js → NestJS **strangler** migration. Master plan:
> [`docs/superpowers/plans/2026-07-09-nestjs-migration-roadmap.md`](superpowers/plans/2026-07-09-nestjs-migration-roadmap.md).
> Update this file in the same PR that changes status. **Last updated: 2026-07-09.**

## At a glance

**The migration is DONE — the app is API-only.** All 9 data modules run on the
NestJS API, the per-module flags + local Next fallbacks are removed, and the app
is now a thin client of `apps/api`. Every `src/data/*` read/write calls the API.

```
Foundation      ██████████████████████████  100%   phases 0–2 + shared + keystone
Read modules    ██████████████████████████  100%   6 of 6 ✅
Write modules   ██████████████████████████  100%   3 of 3 ✅
Cutover (API-only) ███████████████████████  100%   ✅ flags + fallbacks removed
```

**All 9 modules migrated + E2E-verified, then hard-cut-over to API-only (PRs
#6–#18).** The one thing left is an owner env flip in prod (below) — the code is
final.

> ⚠️ **The app now has a hard dependency on the API.** `NEXT_PUBLIC_API_URL` MUST
> be set (web) and the Railway API MUST be up, or pages throw. There is no local
> fallback anymore — see "What the owner must do" below.

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

## 👤 What the owner must do (the code is API-only — this is now required)

Because the fallback is gone, the API is a hard dependency. Do this **before/at**
the next production deploy or prod pages will throw:

1. **Vercel (project `chidental-lab`, Production env):** set
   `NEXT_PUBLIC_API_URL=https://chidental-api-production.up.railway.app`.
2. **Confirm the Railway API is healthy + reachable:** `GET /health` →
   `{"status":"ok","shared":true}` (`shared:true` proves the shared runtime link).
   Make sure the API points at the **prod** Supabase and stays up (it's now on the
   critical path — consider uptime monitoring + a min instance).
3. **Deploy web.** Smoke-test each area (products, clinics, work, invoices,
   dashboard, reports) + one write (edit a clinic) + a spot-check that the invoice
   activity/status-history rows show the right actor.
4. **Rollback** (if needed): revert the cutover commit (`git revert`) to restore
   the local Next fallbacks, or roll Vercel back to the prior deployment.
5. **Local dev now needs the API running:** `npm run dev -w apps/api` alongside
   `npm run dev` (web), with `NEXT_PUBLIC_API_URL=http://127.0.0.1:6061`.
6. Wire **Railway ↔ GitHub auto-deploy** (currently manual `railway up`) so API
   changes ship automatically.

## Remaining nice-to-haves (optional, non-blocking)

- Scope the API's Supabase key down from full service-role where feasible (it
  currently relies on service-role + its own permission checks).
- Add uptime/latency monitoring on the Railway API (now on the critical path).

## Key facts

- **API base:** `https://chidental-api-production.up.railway.app` (serves **zero** prod traffic until a flag flips).
- **Flag:** `USE_API_MODULES` (comma list) + `NEXT_PUBLIC_API_URL`, read via `isModuleOnApi()` in `apps/web/src/lib/config.ts`.
- **Behaviour-preservation invariant:** the API uses a service-role client (bypasses RLS); this is safe **only** where every touched table's read policy is `using (true)`. Verify per module before migrating.
- **Gates:** `npm test` (shared/web/api) + `npm run build` (web/api). tsc/lint are unusable in this repo.
