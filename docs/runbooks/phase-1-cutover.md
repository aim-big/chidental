# Runbook — Phase 1 monorepo cutover (the one risky frontend deploy)

> **Owner action, in a low-traffic window.** The Phase 1 PR relocates the app to
> `apps/web/`. Merging it and switching Vercel's Root Directory are **coupled** —
> they must happen together, because production can only build from one location
> at a time. Everything is code-verified (unit 356, integration 47/47, build
> green from `apps/web`); this runbook is just the deploy switch.

## Why coupled

- Today Vercel builds `big-pos` from the **repo root** (where the Next app used to be).
- After merge, `main` has the Next app at **`apps/web/`** and only a workspace manifest
  at the root — so a root-directory build would fail.
- Therefore: flip Vercel Root Directory to `apps/web` **and** land the restructure on
  `main` in the same window. The PR's Vercel **Preview** check will fail until the Root
  Directory is changed — that red check is expected, not a real failure.

## Steps (low-traffic window)

1. **Change Vercel Root Directory.** Vercel → `big-pos` → Settings → Build & Deployment →
   **Root Directory = `apps/web`**. Save. (Vercel auto-detects the npm workspace and installs
   from the repo root.)
2. **Redeploy the PR preview** (Vercel → the PR's deployment → Redeploy) and confirm the
   preview now builds and the app loads (login → dashboard → invoices → a PDF).
3. **Merge the PR to `main`** — this triggers the production deploy, now building from
   `apps/web`.
4. **Verify production** at `https://chidental.vercel.app`: login, an invoice, a report, a
   printed/PDF invoice. Watch for 5–10 min.

## Rollback (minutes, no DB involved)

- **App broken after deploy:** Vercel → Deployments → promote the previous (pre-merge)
  production deployment. Instant.
- **Then revert the config:** set Root Directory back to the repo root, and `git revert`
  the merge commit on `main`.
- Nothing here touches the database, so there is no DB rollback.

## Notes

- `supabase/` and `docs/` stay at the repo root; only the web app moved.
- Local dev is unchanged: `npm run dev` from the repo root still serves on :6060
  (it delegates into `apps/web`). Your `.env.local` moved to `apps/web/.env.local`.
- `packages/shared` (the Zod schemas → Nest DTOs) is extracted at the start of Phase 2,
  when `apps/api` needs it — not in this PR.
