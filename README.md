# chidental

Lab management system (work orders, invoicing, and billing) for Chi Dental Lab. Built with Next.js, Supabase, Tailwind CSS, and shadcn/ui.

## Stack

- **Next.js 16** (App Router)
- **Supabase** — Postgres + Auth (cookie-based session via `@supabase/ssr`)
- **Tailwind CSS v3** + **shadcn/ui** components
- **React Hook Form** + **Zod** for forms
- **Recharts** for reports

## Getting started

```bash
pnpm install
pnpm dev        # starts the web app AND the NestJS API together
```

The app runs at <http://localhost:6060> (API on :6061). pnpm is the only
allowed package manager — `npm install` is blocked.

## Environment

Copy `.env.example` to `.env.local` and fill in the values (or, on a machine
linked to Vercel, run `vercel env pull .env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=...        # public
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # public
SUPABASE_SERVICE_ROLE_KEY=...       # secret — server-only, never expose
```

`.env.local` is gitignored; never commit real keys.

## Scripts

- `pnpm dev` — start web + API together (`pnpm dev:web` / `pnpm dev:api` for one alone)
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm lint` — run ESLint

## Auth flow

`src/middleware.ts` runs on every request, refreshes the Supabase session via cookies, and redirects:

- unauthenticated requests (anything other than `/login`) → `/login`
- authenticated requests to `/login` → `/dashboard`

Routes under `src/app/(authenticated)/` are gated by middleware; the route group's layout wraps them with `AuthProvider` + `AppShell`.
