# pnpm migration + one-command dev stack — design

**Date:** 2026-07-11
**Status:** Approved (pending spec review)
**Branch:** `chore/pnpm-migration` (own PR, separate from feature work)

## Problem

The local app stack is three servers: web (Next.js, :6060), API (NestJS, :6061), and
local Supabase (:54321). The root `npm run dev` starts **only the web app**, so it is
easy to run the frontend without the backend. When that happens, every server-side
fetch to the API dies with Node's generic `fetch failed`, and the user sees a
"Something went wrong" error page with no hint that the cause is "the API isn't
running". This happened on 2026-07-10 and cost real debugging time.

Decision: migrate the monorepo to pnpm and make **`pnpm dev` the one documented way
to start the app** — it brings up web + API together. If the API is ever unreachable
anyway, the error must say so explicitly.

## Goals

1. `pnpm dev` at the repo root starts web + API in parallel with per-package labeled output.
2. Dependency versions stay **identical** through the migration (lockfile converted, not regenerated).
3. An unreachable API produces a self-explanatory error instead of `fetch failed`.
4. CI, Vercel, and docs all agree that pnpm is the package manager.
5. Accidental `npm install` fails fast with a clear message.

## Non-goals

- Automating or preflight-checking local Supabase/Docker (different failure, different error; not needed yet).
- Upgrading any dependency versions.
- Changing dev ports, module structure, or the NestJS migration roadmap.

## Design

### 1. Workspace migration (npm → pnpm 10.32.1)

- Add `pnpm-workspace.yaml` declaring `apps/*`, `packages/*`.
- Root `package.json`: remove the npm `workspaces` field; add `"packageManager": "pnpm@10.32.1"`.
- Convert the lockfile with `pnpm import` (reads `package-lock.json`, writes
  `pnpm-lock.yaml` with the same resolved versions), then delete `package-lock.json`.
- Add `"preinstall": "npx only-allow pnpm"` to the root so `npm install` /
  `yarn install` abort with an instruction to use pnpm.
- `engines.node >= 20.12.0` unchanged.

### 2. Scripts

Workspace package names: root `chidental-monorepo`, web `chidental`,
API `@chidental/api`, shared `@chidental/shared`.

Root `package.json` scripts become:

| Script | Runs |
|---|---|
| `dev` | web dev + API dev **in parallel** (pnpm `--parallel` + `--filter`, native prefixed output — no `concurrently` dependency) |
| `dev:web` | web dev only |
| `dev:api` | API dev only |
| `build`, `start`, `lint`, `test`, `test:integration`, `test:e2e` | same targets as today, pnpm `--filter` syntax |

`apps/api` `predev`/`prebuild` hooks change content from `npm run build -w
@chidental/shared` to `pnpm --filter @chidental/shared build`. (Verified empirically:
pnpm 10.32.1 runs `pre*` hooks by default, so the "build shared before API starts"
behavior is preserved, including under root `pnpm dev`.)

Web dev does not get a new shared-build step: it doesn't have one today and works;
behavior is preserved, not redesigned.

### 3. Clear error when the API is unreachable

`apps/web/src/lib/api/client.ts` has four `fetch` call sites. Extract one `apiFetch`
helper that wraps `fetch` and, on a connection-level failure (`TypeError: fetch
failed` / `ECONNREFUSED` cause), rethrows:

- **Development:** `Cannot reach the API at <API_URL> — is the API server running?
  \`pnpm dev\` starts web + API together.`
- **Production:** `Cannot reach the API at <API_URL>.` (no dev-command hint)

HTTP-level errors (non-2xx) keep their current messages. Unit test covers the
mapping: connection error → friendly message; non-2xx → unchanged; success passes through.

### 4. CI (`.github/workflows/ci.yml`)

- Add `pnpm/action-setup` (version taken from `packageManager` field).
- `setup-node`: `cache: pnpm`.
- `npm ci` → `pnpm install --frozen-lockfile`.
- All `npm run X -w <pkg>` steps → pnpm `--filter` equivalents; same jobs, same order.

### 5. Vercel

Root Directory stays `apps/web`. Vercel detects pnpm from `pnpm-lock.yaml` at the
repo root and the `packageManager` field — no dashboard changes expected. The first
preview deployment on the PR is the verification gate; if it fails, fix before merge.

### 6. Docs

Update `CLAUDE.md`, `docs/CONVENTIONS.md`, and `apps/web/.env.example` so every
`npm run ...` instruction becomes the pnpm equivalent, and `pnpm dev` is documented
as the way to start the app (starts web + API; Supabase still started separately
via its CLI/Docker).

## Verification

1. Fresh install: remove `node_modules`, `pnpm install`, confirm clean.
2. Gates: `pnpm test` (web, shared, api) and `pnpm build` pass.
3. The real test: `pnpm dev` → both servers up → app loads in browser against the
   seeded local stack (verify skill). Then kill the API process and confirm the
   error page shows the new message, not `fetch failed`.
4. Guard: `npm install` aborts with the only-allow message.
5. PR: CI green, Vercel preview deployment builds and loads.

## Risks & rollback

- **Lockfile conversion drift** — mitigated by `pnpm import` (no re-resolution) and
  the full test+build gates.
- **Vercel monorepo install quirks** — caught by the preview-deployment gate before merge.
- **Muscle memory (`npm run dev`)** — docs updated; the only-allow guard turns the
  mistake into an instant, self-explanatory failure instead of a subtle one.
- **Rollback:** revert the PR; `package-lock.json` comes back with the revert commit.
