# NestJS Migration Roadmap (Strangler Pattern)

> **For agentic workers:** This is the MASTER ROADMAP. Each phase below gets its own
> detailed implementation plan (written with superpowers:writing-plans at phase start,
> executed via superpowers:subagent-driven-development or superpowers:executing-plans).
> Do NOT attempt to execute this roadmap in one pass.

**Goal:** Move all backend logic from Next.js server actions to a NestJS API without any
production downtime or user-visible breakage, ending with `apps/web` (Next.js, frontend
only, Vercel) + `apps/api` (NestJS, Railway) + `packages/shared` (domain logic, Zod
schemas, DB types).

**Architecture:** Strangler pattern. The NestJS API is built and deployed alongside the
existing app, serving zero traffic. Each data module is migrated one at a time behind a
per-module flag inside the existing `src/data/*` functions (components never change).
A flipped module can be flipped back instantly. Old code paths are deleted only after a
soak period.

**Tech Stack:** Next.js 16 / React 19 (stays, frontend), NestJS 11 (new, backend),
npm workspaces monorepo, Supabase (Auth + Postgres, unchanged), Zod 4 shared schemas
→ Nest DTOs via `nestjs-zod`, Vercel (web), Railway (api, staging + production
environments), Sentry on both apps.

## Global Constraints

- UI copy always says **"Clinic"**; code/DB/routes/types/permission keys stay `customer`
  (docs/CONVENTIONS.md). The Nest API modules keep `customer` naming.
- Money rules per docs/CONVENTIONS.md; invoices/billing migrate **last**.
- Gates for every PR: `npm test` and `npm run build` must pass (tsc/lint are not gates).
- DB migrations continue via Supabase MCP `apply_migration` with prod-aligned version
  timestamps. The Nest API introduces **no schema changes** by itself.
- Node >= 20.12, npm (package-lock.json — do NOT switch package managers mid-migration).
- Dev server port 6060 for web (CLAUDE.md). API dev port: 6061 (not 3000/5000/6000/7000).
- No dependency major-version upgrades during the migration. One variable at a time.
- Supabase Auth and the login flow are **never migrated**. `@supabase/ssr` session
  handling stays in Next.js. The API only *verifies* Supabase JWTs.
- Audit writes (`admin_audit_log`, `invoice_activity_log`) must be preserved verbatim in
  every migrated path.
- Production deploys of high-risk steps (Phase 1 restructure deploy, invoices flip in
  Phase 3) happen in a low-traffic window (owner prefers midnight). Everything else can
  ship any time because merged code is inert until its flag flips.

## Branching & deploy safety model (answers "will it break prod?")

- **No long-lived migration branch.** Short-lived PR branches → main, continuously.
  A weeks-long branch would diverge from ongoing main work and make the final merge the
  riskiest event of the project. Instead, every merge is small and individually inert.
- **Why merged code can't break prod:** new Nest code deploys to Railway but serves no
  traffic; frontend flips happen per module via env flag; the login/auth path is never
  touched.
- **Testing before live:** every PR gets a Vercel preview deployment (pointed at staging
  Supabase) and the API has a Railway staging environment. Verify there, then merge.
- **Rollback story:** Vercel = instant rollback (promote previous deployment). Railway =
  redeploy previous build. Module flip = set the env flag back and redeploy (minutes).
  Nothing in this plan requires a DB rollback.
- **API-first ordering:** the API version of an endpoint is always deployed and verified
  on staging before the frontend flag flips. API changes stay backward compatible while
  any flag is off.

---

## Phase 0 — Safety net (no behavior change, no restructure)

Everything here is valuable even if the migration stopped tomorrow.

**Scope / tasks:**
1. **CI gate:** GitHub Actions workflow running `npm test` + `npm run build` on every PR.
2. **Staging Supabase project** + seed script; Vercel Preview env vars point at staging
   (never prod data). Document the env matrix in docs/ARCHITECTURE.md.
3. **Zod validation audit:** every exported server action in `src/data/*-actions.ts`
   parses its input through a schema in `src/domain/schemas.ts` before any DB call.
   These schemas become the Nest DTOs in Phase 3 — this is migration work in disguise.
4. **Baseline behavioral tests:** integration tests covering login/session and the
   invoice + billing money paths as they behave TODAY. These are the contract the Nest
   version must satisfy in Phase 3.

**Exit criteria:** CI green on PRs; staging env usable end-to-end; all action inputs
schema-validated; money-path integration tests green.

**Prod risk:** none (validation tightening could reject previously-accepted malformed
input — verify each schema against real call sites in the PR).

→ Detailed plan: `2026-XX-XX-phase-0-safety-net.md` (write at phase start).

## Phase 1 — Monorepo restructure (the one risky frontend deploy)

**Scope / tasks:**
1. Move the app to `apps/web/` (src, public, configs). Root `package.json` becomes an
   npm workspaces manifest.
2. Extract `packages/shared/`: `src/domain/*`, `src/lib/database.types.ts`,
   `src/lib/database-generated.types.ts`. `apps/web` imports from `@chidental/shared`.
3. Update Vercel project Root Directory to `apps/web`. Verify the preview deployment
   completely (login, invoices, reports, PDFs) before merging.
4. Merge and confirm the production deploy **in the low-traffic window**. Keep the
   previous deployment ready for instant rollback.
5. Update CLAUDE.md / AGENTS.md / docs for new paths and commands.

**Constraint:** pure file moves + import updates. Zero behavior change. `git mv` to
preserve history.

**Exit criteria:** prod runs from `apps/web` with identical behavior; tests green from
the new layout.

**Prod risk:** medium (deploy-config change) — mitigated by full preview verification +
instant rollback. This is midnight-deploy #1.

→ Detailed plan: `2026-XX-XX-phase-1-monorepo.md`.

## Phase 2 — NestJS scaffold on Railway (zero prod risk)

**Scope / tasks:**
1. `apps/api`: NestJS 11 skeleton — ConfigModule (env validation with Zod), health
   endpoint (`GET /health`), global exception filter, Sentry.
2. **Auth guard:** verifies the Supabase JWT from the `Authorization` header (Supabase
   JWKS / `getClaims`-equivalent). Attaches user id + role to the request. Permission
   checks call `packages/shared` `permissions` functions — single enforcement point,
   required from module one because the API's service-role DB connection bypasses RLS.
3. Supabase connection: service-role client (or `pg` via Supabase pooler, port 6543)
   configured per environment.
4. Railway service from the same GitHub repo: root `apps/api`, watch paths
   `apps/api/**` + `packages/shared/**`, `staging` + `production` environments,
   `api.<domain>` on production. CORS allows the web origins.
5. Frontend gets `NEXT_PUBLIC_API_URL` per environment + a thin authenticated API client
   in `apps/web` (attaches the user's Supabase access token).

**Exit criteria:** authenticated `GET /health` round-trip works from staging web →
staging API and prod web → prod API. No user traffic depends on it.

**Prod risk:** none (additive only).

→ Detailed plan: `2026-XX-XX-phase-2-nest-scaffold.md`.

## Phase 3 — Module-by-module strangler migration

**Order (lowest blast radius first):**
1. reports (read-only)
2. dashboard (read-only)
3. products
4. customers + employees/roles
5. work
6. **invoices + billing + credits (last — money, audit logs, permissions)**

**The repeating pattern per module (each gets its own detailed plan):**
1. Build the Nest module: controller + service + DTOs generated from the shared Zod
   schemas (`nestjs-zod`), permission guard wired, audit-log writes preserved.
2. Port/extend the Phase 0 behavioral tests to run against the API on staging; verify
   parity with the current server-action behavior.
3. Flip seam: the existing functions in `apps/web/src/data/<module>.ts` keep their exact
   signatures; internally they branch on a per-module flag:
   `USE_API_MODULES=reports,dashboard` (comma list, read via one helper in
   `src/lib/config.ts`). Components are never edited. Flag ON in Preview/staging first.
4. Enable the flag in production (invoices flip = midnight-deploy #2; others any time).
   Monitor Sentry + Railway logs during a soak period (≥ 1 week for invoices).
5. After soak: delete the old server-action body for that module, keeping the facade
   function that now only calls the API.

**Exit criteria:** all modules served by the API in prod; `apps/web/src/data/*` contains
only thin API-client facades; zero Supabase service queries left in Next.js (except auth
session handling).

**Prod risk:** per-module, individually reversible via the flag.

## Phase 4 — Cleanup & hardening

**Scope / tasks:**
1. Remove flags and dead code paths; collapse the data facades into the API client.
2. Decide the RLS posture now that the API owns authorization (keep RLS as
   defense-in-depth is the default; document in docs/CONVENTIONS.md).
3. Rotate/scope keys: anon key only in web; service-role key only in Railway.
4. Docs: rewrite docs/ARCHITECTURE.md for the two-app topology; update
   docs/CONVENTIONS.md ("new backend code goes in apps/api, structured as Nest
   module/controller/service/DTO"); update USER_GUIDE if any URLs changed (they
   shouldn't).

**Exit criteria:** no dual code paths; docs match reality; a new engineer can tell
where any new endpoint goes.

---

## Standing risk register (re-check at every phase)

| Risk | Mitigation |
|---|---|
| Login breaks | Structurally impossible from this plan: auth flow files are never in scope. Phase 0 adds a login integration test as a tripwire anyway. |
| RLS bypass via service role | Auth guard + shared `permissions` checks are mandatory in every Nest module from Phase 2; permission-matrix tests per module in Phase 3. |
| Audit logs silently dropped | Explicit task in every Phase 3 module plan; behavioral tests assert audit rows are written. |
| Postgres connection exhaustion | Railway is long-lived but staging+prod × pool size must stay under Supabase limits; use the pooler (6543). |
| Long-lived branch divergence | Forbidden by the branching model above. |
| Breaking API change while a flag is off | API stays backward compatible until the corresponding old path is deleted in Phase 4. |
| PDF generation (`@react-pdf/renderer`) | Stays in Next.js for the whole migration; revisit only after Phase 4. |
| Mixed migration versions | All schema changes keep flowing through Supabase MCP with prod-aligned timestamps; the API never runs its own migrations. |
