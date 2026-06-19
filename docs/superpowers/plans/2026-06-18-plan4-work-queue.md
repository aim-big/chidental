# Plan 4 — Work Queue, Server-First (Spec 1, Plan 4 of 4)

**Goal:** Move the `/work` queue behind the `src/data/` seam (server read + the existing `updateWorkStatusAction`), rebuild the page as a Server Component + a client island that uses `useOptimistic` for snappy status changes with automatic rollback on failure, and finally wire the `on_hold` → `resume_status` round-trip (Plan 2's column + `production.ts`'s `hold()`/`resume()` helpers, currently unused).

**Why now:** Last module rebuild of Spec 1. After this, every Supabase caller is behind `src/data/` and the foundation is fully proven.

## Established patterns (same as Plan 3)
- Server read: `await createClient()` (SSR, RLS-aware) inside `src/data/*`.
- Write: existing `updateWorkStatusAction` in `src/data/invoice-actions.ts` (gated `invoices.view` → admin client → `revalidatePath`). Reuse it; the work page and invoice-detail share one write path.
- Client island gets data as props, calls the action, shows toast on error.

## Architecture decisions
- **Read:** new `src/data/work.ts` → `getWorkQueue()` returning `{ rows, stages }` mirroring the current page query exactly (`invoice_items` + `invoices(.. , customers(clinic_name))`, ordered by `work_status_updated_at desc, id`). Voided-invoice filtering stays (do it in the query or in the mapping as today).
- **Page:** `work/page.tsx` → async Server Component: `const { rows, stages } = await getWorkQueue()` → `<WorkQueueClient rows={rows} stages={stages} />`.
- **Island:** `WorkQueueClient` (`'use client'`) holds grouping (`encodeWork`/`orderedGroupKeys`), filter chips, search, collapse — moved verbatim — but replaces the manual optimistic `setState`/`recentlyMoved` with **`useOptimistic`**: apply the move optimistically, call `updateWorkStatusAction`, and on `!ok` toast the error (the optimistic state auto-reverts on the next server render). Keep the "moved to" hint.
- **on_hold round-trip:** enhance `updateWorkStatusAction` to manage `resume_status` automatically (shared benefit for both pages): when the new status becomes `on_hold` (from a non-hold status), store the prior `work_status` in `resume_status` (via `production.ts` `hold()`); when moving OFF `on_hold`, clear `resume_status`. The work-queue dropdown for an `on_hold` item offers a **"Resume"** option that targets `resume(resume_status)` (the remembered status, or `received`). Use `production.ts` `hold()`/`resume()`.

## Verification strategy
Same as Plan 3: `tsc` + `lint` + `vitest` (Node 22) green after each task; **`npm run build`** green (catches RSC / 'use server' boundary issues tsc misses); browser-verify the queue (render, filter, search, a status change with optimistic update, an on_hold→resume round-trip) as admin, reverting prod data after writes.

---

## Task 1 — Data read + action enhancement
- `src/data/work.ts`: `getWorkQueue()` (SSR) → `{ rows, stages }`, mirroring the page's `invoice_items` select + ordering; exclude voided invoices. Export the row type.
- Enhance `updateWorkStatusAction` (`src/data/invoice-actions.ts`): read the item's current `work_status` first; if `input.work_status === 'on_hold'` and current ≠ on_hold → set `resume_status = current` (via `hold()`); else set `resume_status = null`. Keep the existing gate + revalidation. Update the `invoice_items` write to include `resume_status`.
- `tsc`/`lint`/`vitest` green. Commit.

## Task 2 — Page → Server Component + useOptimistic island
- `work/page.tsx` → Server Component calling `getWorkQueue()`.
- `src/components/work/WorkQueueClient.tsx` (`'use client'`) — grouping/filter/search/collapse verbatim; `useOptimistic` for status moves; dropdown calls `updateWorkStatusAction`; toast on error. No `@/lib/supabase` import.
- on_hold items: dropdown shows a **Resume** option (→ `resume(resume_status)`); selecting On Hold triggers the hold path (handled server-side by the action).
- Browser-verify (admin): render, filter chips, search, a status change (optimistic, then reverted in DB), and an on_hold→resume round-trip (reverted). `npm run build` green. Commit.

## Task 3 — Verify + review + docs
- Full `npm run build` + tsc + lint + vitest green.
- `grep` confirms no `@/lib/supabase` in `work/page.tsx` or `WorkQueueClient`.
- Code review the diff; fix legit findings.
- Update `docs/modules/work-status.md` (note server-first + on_hold/resume now wired). Commit; update ledger.

## Success criteria
- `/work` is a Server Component; status changes go through `updateWorkStatusAction` with `useOptimistic` UX.
- `on_hold` stores `resume_status`; resuming returns to the remembered status.
- No `@/lib/supabase` in the work page/island; build + tsc + lint + tests green; flows browser-verified; review clean.

## Not in this plan
- Consolidating `lib/work-stages.ts` vs `domain/production.ts` duplication (pre-existing tech debt — note, don't fix here).
- Security/RLS (Spec 5).
