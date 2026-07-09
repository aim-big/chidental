# NestJS Migration — Progress Tracker

> Live status of the Next.js → NestJS **strangler** migration. Master plan:
> [`docs/superpowers/plans/2026-07-09-nestjs-migration-roadmap.md`](superpowers/plans/2026-07-09-nestjs-migration-roadmap.md).
> Update this file in the same PR that changes status. **Last updated: 2026-07-09.**

## At a glance

**Every hard structural / infra / architectural problem is solved and merged.**
What remains is (a) mechanical read modules on a proven pattern, (b) money/audit
write modules, and (c) owner-run prod cutovers (flag-flip + soak).

```
Foundation  ██████████████████████████  100%   (phases 0–2 + shared + keystone)
Read modules █████████████████░░░░░░░░░   67%   (4 of 6 done)
Write modules ░░░░░░░░░░░░░░░░░░░░░░░░░░    0%   (0 of 3)
Phase 4 cleanup ░░░░░░░░░░░░░░░░░░░░░░░░    0%
```

**Code migrated to the API: 4 of ~9 modules.** No architectural unknowns remain.

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
| 5 | dashboard | ⬜ | — | dashboard aggregation reachable by API | — |
| 6 | reports | ⬜ | — | reports aggregation reachable by API | — |

### Writes (data mutation — money / audit critical, **invoices last**)

| # | Module | Status | PR | Needs | Notes |
|---|--------|--------|----|-------|-------|
| 7 | customer-actions | ⬜ | — | shared Zod DTOs at runtime (✅ keystone) | permission gate + validation |
| 8 | work-actions (status) | ⬜ | — | shared Zod DTOs, production logic | status transitions + history |
| 9 | invoice-actions | 🔒 last | — | audit log, billing-settings, production, statement in API | money + audit — highest care |

## Prerequisite work items

| Item | Status | Unblocks |
|------|--------|----------|
| Make dashboard aggregation (`@/lib/dashboard`) reachable by API | ⬜ | dashboard read |
| Make reports aggregation (`@/lib/reports`) reachable by API | ⬜ | reports read |
| Port audit / billing-settings / production / statement to API | ⬜ | invoice writes |
| **Reconcile duplicate status logic**: `@/lib/invoice-status` vs `@chidental/shared` `domain/billing.ts` both define `isVoided`/`isOutstanding`/`isOverdue`/`nextStatusAfterPayment` — with a subtly *different* `isOverdue` (web's guards null/empty `due_date`; billing's doesn't). Consolidate into shared. | ⬜ (Phase 4) | dashboard/reports aggregation in API + removes a money-logic landmine |

## Owner-run steps (👤 — not codeable)

1. Per merged module: set `USE_API_MODULES=<module>` (append) in Vercel → redeploy → soak ≥1 week, watch errors/latency.
2. Wire Railway ↔ GitHub auto-deploy (currently manual `railway up` / relies on Railway build on push).
3. Roll back instantly by removing the module from `USE_API_MODULES` if anything regresses.

## Key facts

- **API base:** `https://chidental-api-production.up.railway.app` (serves **zero** prod traffic until a flag flips).
- **Flag:** `USE_API_MODULES` (comma list) + `NEXT_PUBLIC_API_URL`, read via `isModuleOnApi()` in `apps/web/src/lib/config.ts`.
- **Behaviour-preservation invariant:** the API uses a service-role client (bypasses RLS); this is safe **only** where every touched table's read policy is `using (true)`. Verify per module before migrating.
- **Gates:** `npm test` (shared/web/api) + `npm run build` (web/api). tsc/lint are unusable in this repo.
