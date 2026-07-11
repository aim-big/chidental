# chidental-lab

## Monorepo layout (pnpm workspaces)
The app lives in **`apps/web/`** (Next.js frontend, Vercel) with the NestJS backend in
**`apps/api/`** and shared types in **`packages/shared/`** (strangler migration in
progress — see `docs/superpowers/plans/2026-07-09-nestjs-migration-roadmap.md`). The repo
root is a workspace manifest — its `build`/`test`/`test:integration`/`test:e2e` scripts
delegate into `apps/web` via pnpm `--filter`, so run them from the **root** as before.
**pnpm is the only allowed package manager** (`npm install` is blocked). `supabase/` (DB
migrations + seed) and `docs/` stay at the root — they're shared infra, not app-specific.
Vercel's **Root Directory must be `apps/web`** for production builds.

## Conventions & decisions — read before changing UI or behavior
Naming, terminology, money rules, permissions, and architecture decisions live in
**[docs/CONVENTIONS.md](docs/CONVENTIONS.md)**. Follow it; record new decisions there.
Key rule: the UI always says **"Clinic"**, but code/DB/routes/types/permission keys stay
`customer`. End-user module guide: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## Dev server
**`pnpm dev`** (repo root) starts the app stack: web on **http://localhost:6060** AND the
NestJS API on **:6061** together — the web app is unusable without the API, so never start
just one by accident (`pnpm dev:web` / `pnpm dev:api` exist for running one on purpose).
Local Supabase (:54321) still starts separately (`supabase start`, needs Docker).
The web port is pinned via `next dev -p 6060` in **`apps/web/package.json`** — do not assume
3000. (Avoid 5000/7000 = macOS AirPlay Receiver, and 6000 = browser-blocked X11 port.)
