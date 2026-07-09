# chidental-lab

## Monorepo layout (npm workspaces)
The app lives in **`apps/web/`** (Next.js frontend, Vercel). The repo root is a workspace
manifest — its `dev`/`build`/`test`/`test:integration`/`test:e2e` scripts delegate into
`apps/web` (`-w apps/web`), so run them from the **root** as before. `supabase/` (DB
migrations + seed) and `docs/` stay at the root. Vercel's **Root Directory must be
`apps/web`** for production builds. (NestJS `apps/api` + `packages/shared` arrive in later
migration phases — see `docs/superpowers/plans/2026-07-09-nestjs-migration-roadmap.md`.)

## Conventions & decisions — read before changing UI or behavior
Naming, terminology, money rules, permissions, and architecture decisions live in
**[docs/CONVENTIONS.md](docs/CONVENTIONS.md)**. Follow it; record new decisions there.
Key rule: the UI always says **"Clinic"**, but code/DB/routes/types/permission keys stay
`customer`. End-user module guide: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## Dev server
This project runs on **http://localhost:6060** (`npm run dev` from the repo root).
The port is pinned via `next dev -p 6060` in **`apps/web/package.json`** — do not assume 3000.
(Avoid 5000/7000 = macOS AirPlay Receiver, and 6000 = browser-blocked X11 port.)
