# pnpm Migration + One-Command Dev Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the monorepo from npm workspaces to pnpm so `pnpm dev` starts web + API together, and make an unreachable API produce an actionable error instead of `fetch failed`.

**Architecture:** Lockfile is converted (`pnpm import`), not regenerated, so all 914 resolved dependency versions stay identical. Internal deps switch to the `workspace:*` protocol (required — pnpm resolves `"*"` from the npm registry and fails on private packages; verified empirically). A single `apiFetch` wrapper in the web app maps connection-level failures to a self-explanatory error.

**Tech Stack:** pnpm 10.32.1, npm-workspaces monorepo (Next.js web `chidental`, NestJS API `@chidental/api`, shared lib `@chidental/shared`), vitest, GitHub Actions, Vercel (Root Directory `apps/web`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-pnpm-migration-dev-stack-design.md`
- Branch: `chore/pnpm-migration` (already created; spec committed on it)
- Dependency versions must NOT change: convert the lockfile with `pnpm import`; never delete + regenerate.
- pnpm version: exactly `10.32.1` in the `packageManager` field.
- Workspace package names (for `--filter`): web = `chidental`, API = `@chidental/api`, shared = `@chidental/shared`, root = `chidental-monorepo`.
- Verified pnpm 10.32.1 behaviors (do not re-litigate): `pre*` hooks DO run, including under `pnpm --parallel --filter ... run dev`; parallel output is prefixed per package dir; `pnpm import` works once internal deps use `workspace:*`.
- Node `>=20.12.0` unchanged. Dev ports unchanged (web 6060, API 6061, Supabase 54321).
- Gates after every task: the commands listed in that task must pass before commit.

---

### Task 1: pnpm workspace migration (manifests + lockfile)

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root), `apps/web/package.json:37` (shared dep), `apps/api/package.json:17` (shared dep)
- Create: `pnpm-lock.yaml` (via `pnpm import`)
- Delete: `package-lock.json`

**Interfaces:**
- Produces: a repo where `pnpm install` works and workspace links resolve; root `pnpm` config block (`overrides`) that later tasks leave untouched.

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Switch internal deps to `workspace:*`**

In `apps/web/package.json` dependencies AND `apps/api/package.json` dependencies:

```diff
-    "@chidental/shared": "*",
+    "@chidental/shared": "workspace:*",
```

- [ ] **Step 3: Rewrite root `package.json`**

Replace the whole file with (scripts converted in this same edit; `workspaces` removed — pnpm uses the yaml; npm `overrides` moved to `pnpm.overrides`, which is where pnpm reads them):

```json
{
  "name": "chidental-monorepo",
  "private": true,
  "packageManager": "pnpm@10.32.1",
  "engines": {
    "node": ">=20.12.0"
  },
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "dev": "pnpm --parallel --filter chidental --filter @chidental/api run dev",
    "dev:web": "pnpm --filter chidental run dev",
    "dev:api": "pnpm --filter @chidental/api run dev",
    "build": "pnpm --filter chidental run build",
    "start": "pnpm --filter chidental run start",
    "lint": "pnpm --filter chidental run lint",
    "test": "pnpm --filter chidental run test",
    "test:integration": "pnpm --filter chidental run test:integration",
    "test:e2e": "pnpm --filter chidental run test:e2e"
  },
  "pnpm": {
    "overrides": {
      "postcss": "^8.5.10"
    },
    "onlyBuiltDependencies": [
      "sharp",
      "unrs-resolver"
    ]
  }
}
```

(`onlyBuiltDependencies`: pnpm 10 blocks dependency postinstall scripts by default; a trial install of this exact lockfile flagged `sharp@0.34.5` (Next.js image optimization) and `unrs-resolver@1.11.1` as the only two. Approving them up-front keeps the install warning-free.)

- [ ] **Step 4: Convert `apps/api` hook scripts to pnpm syntax**

In `apps/api/package.json`:

```diff
-    "predev": "npm run build -w @chidental/shared",
+    "predev": "pnpm --filter @chidental/shared build",
     "dev": "nest start --watch",
-    "prebuild": "npm run build -w @chidental/shared",
+    "prebuild": "pnpm --filter @chidental/shared build",
```

- [ ] **Step 5: Convert the lockfile and install**

```bash
pnpm import          # reads package-lock.json → writes pnpm-lock.yaml (~9300 lines, 914 resolutions)
rm package-lock.json
rm -rf node_modules apps/web/node_modules apps/api/node_modules packages/shared/node_modules
pnpm install
```

Expected: install completes; `node_modules/@chidental/shared` under `apps/web` and `apps/api` is a symlink to `packages/shared`.

Expected: NO "Ignored build scripts" warning (Step 3's `onlyBuiltDependencies` pre-approves `sharp` + `unrs-resolver`, the only two a trial install flagged). If the warning appears with a *different* package name, add exactly that name to `onlyBuiltDependencies` and re-run `pnpm install`.

- [ ] **Step 6: Verify the gates still pass**

```bash
pnpm --filter @chidental/shared build
pnpm --filter @chidental/shared test
pnpm test
pnpm --filter @chidental/api test
pnpm --filter @chidental/api build
pnpm build
```

Expected: all pass. If a build fails with "Cannot find module 'X'": that's a phantom dependency exposed by pnpm's strict node_modules — add `X` to the *failing workspace's* `dependencies`/`devDependencies` at the version already in `pnpm-lock.yaml`, `pnpm install`, retry.

- [ ] **Step 7: Verify the npm guard**

```bash
npm install --dry-run 2>&1 | head -5
```

Expected: fails with only-allow's message telling you to use pnpm. If a stray `package-lock.json` got recreated, delete it.

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml package.json apps/web/package.json apps/api/package.json
git rm --cached package-lock.json 2>/dev/null; git add -u
git commit -m "chore: migrate monorepo from npm to pnpm workspaces"
```

---

### Task 2: One-command dev stack smoke test

**Files:**
- None modified — this task proves Task 1's `dev` script does what the spec promises before we build on it.

**Interfaces:**
- Consumes: root `pnpm dev` from Task 1.

- [ ] **Step 1: Start the stack**

Run `pnpm dev` (background it). Wait up to 60s, then:

```bash
curl -s -o /dev/null -w "web: %{http_code}\n" http://localhost:6060
curl -s -o /dev/null -w "api: %{http_code}\n" http://localhost:6061
```

Expected: `web: 307` (locale/login redirect) and `api: 404` (no root route — any HTTP status ≠ 000 means the server is up). Output lines must be prefixed `apps/web dev:` / `apps/api dev:`, and the API's `predev` (shared build) must appear before nest starts.

- [ ] **Step 2: Stop the stack, no commit** (nothing changed; if Step 1 fails, fix Task 1 before proceeding).

---

### Task 3: `apiFetch` wrapper — actionable error when the API is down (TDD)

**Files:**
- Create: `apps/web/src/lib/api/api-fetch.ts`
- Test: `apps/web/src/lib/api/api-fetch.test.ts`
- Modify: `apps/web/src/lib/api/client.ts:22,42,56,90` (the four `fetch(` call sites)

**Interfaces:**
- Produces: `apiFetch(url: string, init?: Parameters<typeof fetch>[1]): Promise<Response>` — drop-in for `fetch`, but connection-level `TypeError`s are rethrown as `Error("Cannot reach the API at <origin>…", { cause })`.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/api/api-fetch.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api-fetch'

// Node reports "API server not running" as `TypeError: fetch failed` — opaque to
// anyone who doesn't know the local stack is three servers. These tests pin the
// mapping to an actionable message (and pin that everything else passes through).
describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('maps connection failures to an actionable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(apiFetch('http://localhost:6061/customers')).rejects.toThrow(
      'Cannot reach the API at http://localhost:6061.',
    )
  })

  it('adds the pnpm dev hint in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(apiFetch('http://localhost:6061/customers')).rejects.toThrow(
      'Cannot reach the API at http://localhost:6061 — is the API server running? `pnpm dev` starts web + API together.',
    )
  })

  it('preserves the original error as cause', async () => {
    const original = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original))
    const err = await apiFetch('http://localhost:6061/x').catch((e: unknown) => e)
    expect((err as Error).cause).toBe(original)
  })

  it('returns successful responses untouched', async () => {
    const res = new Response('{}', { status: 200 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))
    await expect(apiFetch('http://localhost:6061/x')).resolves.toBe(res)
  })

  it('does not wrap non-TypeError failures (e.g. aborts)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')))
    await expect(apiFetch('http://localhost:6061/x')).rejects.toThrow('aborted')
  })
})
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm --filter chidental exec vitest run src/lib/api/api-fetch.test.ts`
Expected: FAIL — cannot resolve `./api-fetch`.

- [ ] **Step 3: Implement** — `apps/web/src/lib/api/api-fetch.ts`

```ts
// Drop-in `fetch` for calls to the NestJS API. A connection-level failure (API
// process not running, port unreachable) surfaces from undici as an opaque
// `TypeError: fetch failed`; rethrow it naming the API origin — and, in dev,
// the fix — so the error page tells the reader what actually happened.
export async function apiFetch(
  url: string,
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    if (err instanceof TypeError) {
      const hint =
        process.env.NODE_ENV === 'development'
          ? ' — is the API server running? `pnpm dev` starts web + API together.'
          : '.'
      throw new Error(`Cannot reach the API at ${new URL(url).origin}${hint}`, { cause: err })
    }
    throw err
  }
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `pnpm --filter chidental exec vitest run src/lib/api/api-fetch.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Wire it into `client.ts`**

Add to the imports at the top of `apps/web/src/lib/api/client.ts`:

```ts
import { apiFetch } from './api-fetch'
```

Then replace `await fetch(` with `await apiFetch(` at exactly the four call sites (lines 22, 42, 56, 90 — in `apiGet`, `apiGetCached`, `apiGetOrNull`, `apiSend`). No other changes to `client.ts`.

- [ ] **Step 6: Full web gates**

Run: `pnpm test && pnpm build`
Expected: all unit tests pass; build compiles (proves the `next: { revalidate }` init in `apiGetCached` still typechecks through `Parameters<typeof fetch>[1]`).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/api/api-fetch.ts apps/web/src/lib/api/api-fetch.test.ts apps/web/src/lib/api/client.ts
git commit -m "feat(web): name the cause when the API is unreachable instead of 'fetch failed'"
```

---

### Task 4: CI workflow on pnpm

**Files:**
- Modify: `.github/workflows/ci.yml` (whole file)

**Interfaces:**
- Consumes: `packageManager` field from Task 1 (pnpm/action-setup reads it — do NOT also pass a `version:` input).

- [ ] **Step 1: Replace `.github/workflows/ci.yml` with**

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

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        # version comes from the root package.json "packageManager" field

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      # Build shared to its CJS dist first: apps/api consumes @chidental/shared
      # at runtime through the package's `require` → dist condition, so the API
      # build (and any Node consumer) needs dist present. Bundler consumers
      # (web, vitest) use the TS source directly and don't depend on this.
      - name: Build (shared)
        run: pnpm --filter @chidental/shared build

      - name: Unit tests (shared)
        run: pnpm --filter @chidental/shared test

      - name: Unit tests (web)
        run: pnpm --filter chidental test

      - name: Unit tests (api)
        run: pnpm --filter @chidental/api test

      - name: Build (api)
        run: pnpm --filter @chidental/api build

      - name: Build (web)
        # Dummy Supabase vars: the client factories read these lazily, but a
        # statically-prerendered page (e.g. /login) still evaluates one at build.
        # Real secrets are never needed to compile — only to run.
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key
          SUPABASE_SERVICE_ROLE_KEY: dummy-service-role-key
        run: pnpm --filter chidental build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the gate on pnpm"
```

(CI can't run locally — it's verified by the PR in Task 6.)

---

### Task 5: Docs say pnpm

**Files:**
- Modify: `CLAUDE.md:3` (heading), `CLAUDE.md:17-22` (dev server section)
- Modify: `docs/CONVENTIONS.md:174-178` (CI gate + test tiers)
- Modify: `apps/web/.env.example:14,19`

**Interfaces:** none — text only.

- [ ] **Step 1: CLAUDE.md**

Heading line 3: `## Monorepo layout (npm workspaces)` → `## Monorepo layout (pnpm workspaces)`.
In the same paragraph, update the delegation note: root scripts delegate via pnpm `--filter` (not `-w apps/web`).
Dev server section: replace the `npm run dev` sentence so it reads that **`pnpm dev`** (repo root) starts **web (:6060) + API (:6061) together**, `pnpm dev:web` / `pnpm dev:api` run one alone, and local Supabase (:54321) still starts separately.

- [ ] **Step 2: docs/CONVENTIONS.md lines 174–178**

`npm test` → `pnpm test`; `npm run build` → `pnpm build`; `npm run test:integration` → `pnpm test:integration`; `npm run test:e2e` → `pnpm test:e2e`. Leave the surrounding prose untouched.

- [ ] **Step 3: apps/web/.env.example**

Line 14: ``(run `npm run dev -w apps/api`)`` → ``(run `pnpm dev:api`, or `pnpm dev` for the whole stack)``.
Line 19: ``npm run test:integration`` → ``pnpm test:integration``.

- [ ] **Step 4: Sweep for stragglers**

Run: `grep -rn "npm run\|npm ci\|npm install\|npm test" --include="*.md" --include="*.example" . | grep -v node_modules | grep -v docs/superpowers`
Expected: no hits outside historical plan/spec docs. Fix any real doc that still instructs npm.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/CONVENTIONS.md apps/web/.env.example
git commit -m "docs: pnpm is the package manager; pnpm dev starts the full stack"
```

---

### Task 6: End-to-end verification + PR

**Files:** none (verification only; PR creation).

- [ ] **Step 1: Fresh-clone-equivalent install**

```bash
rm -rf node_modules apps/web/node_modules apps/api/node_modules packages/shared/node_modules
pnpm install --frozen-lockfile
```

Expected: clean install, no "Ignored build scripts" warning (Task 1 resolved it).

- [ ] **Step 2: All gates**

```bash
pnpm --filter @chidental/shared build && pnpm --filter @chidental/shared test && pnpm test && pnpm --filter @chidental/api test && pnpm --filter @chidental/api build && pnpm build
```

Expected: everything green.

- [ ] **Step 3: The bug that started this — in a real browser**

Use the **verify skill** (seeded local Supabase stack + QA login) with `pnpm dev` running: app loads normally. Then kill ONLY the API process and reload a data page. Expected: the error page shows "Cannot reach the API at http://localhost:6061 — is the API server running? `pnpm dev` starts web + API together." — NOT "fetch failed".

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin chore/pnpm-migration
gh pr create --title "chore: migrate to pnpm; pnpm dev starts web + API together" --body "$(cat <<'EOF'
## Why
Running the frontend without the backend produced an unexplained "fetch failed" error page (2026-07-10). Root cause: `npm run dev` started only 1 of the 2 app servers.

## What
- npm workspaces → pnpm 10 (lockfile converted with `pnpm import`; dependency versions unchanged)
- `pnpm dev` starts web + API together; `pnpm dev:web` / `pnpm dev:api` for one alone
- Internal deps use `workspace:*`; `npm install` blocked by only-allow
- Unreachable API now reports "Cannot reach the API at <origin> — is the API server running?" instead of `fetch failed` (unit-tested)
- CI + docs converted

Spec: docs/superpowers/specs/2026-07-11-pnpm-migration-dev-stack-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Merge gates**

Wait for CI (pnpm-based) to go green AND the Vercel preview deployment to build + load. If Vercel's install fails, check the deployment build logs — expected setup is zero-config (pnpm-lock.yaml at repo root + `packageManager` field; Root Directory `apps/web` unchanged). Do not merge until both are green.
