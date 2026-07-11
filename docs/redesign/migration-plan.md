# Redesign — Phase 5 & 6: Representative Screens + Migration Plan

System of record: [../../DESIGN.md](../../DESIGN.md). Audit: [audit.md](./audit.md). Directions:
[directions.md](./directions.md).

> **Status (executed):** the plan below has been implemented and committed (`feat(web): redesign
> UI to the 'Console' design system`). Gates green: `npm run build` ✓, `npm test` 278/278 ✓;
> verified light+dark across all screens on the seeded local stack. Remaining follow-ups are
> listed at the end.

## Phase 5 — Representative screens (built first, then rolled out)
1. **App shell / navigation** — espresso `--rail`, brand-accent active item (`aria-current`),
   ⌘K, collapse + mobile drawer, light/dark toggle. ✓
2. **Invoice money flow** (highest-traffic) — list (PageHeader + StatusPill + Money in DataTable);
   **detail heroes Balance due** and **promotes Record Payment to the primary CTA**; raw tables
   wrapped for mobile; danger-tokenized Void/Delete. ✓
3. **New/Edit invoice form** (component-heavy) — migrated the gray-island onto `Field` +
   `Surface` sections (de-nested), `Money`, `PageHeader`, Button `loading`; added route
   `loading.tsx`/`error.tsx`. ✓

## Phase 6 — Phased migration (executed)
| # | Phase | Result |
|---|---|---|
| 0 | Tokens & global styles | globals.css rewritten (OKLCH light+dark, semantic + rail + surface tokens, warm elevation, real `.dark` block, pre-paint theme script). ✓ |
| 1 | Primitives | Added StatusPill, Money, Metric, Field, PageHeader, Surface, ThemeToggle; restyled Badge (semantic), Card (radius/flat), Button (loading), Input (focus). ✓ |
| 2 | Shared patterns | Status via StatusPill; money via Money; semantic tokens; EmptyState adoption; route states on invoice paths. ✓ |
| 3 | App shell | Shipped (5.1). ✓ |
| 4 | Representative screens | Shipped (5.2, 5.3). ✓ |
| 5 | Work | StatusPill convergence, keyboard-operable board, aria-pressed chips, tokenized chrome. ✓ (per-lab class-string stage colours mapped to semantic tones — see follow-ups) |
| 6 | Clinics + Products | Hero Outstanding, StatusPill/Money/PageHeader, native checkbox → Checkbox, twins converged, label association. ✓ |
| 7 | Dashboard + Reports | One hero Metric, tokenized WIP dots + chart vars + aging ramp, fixed skeletons. ✓ |
| 8 | Settings + Login + Profile + Statement | Single `<h1>` per page, brand-accent rail, espresso login, tokenized colours, EmptyState adoption. ✓ |

## Keep / Restyle / Refactor / Replace / Delete — as executed
Kept+restyled the token-safe primitives; refactored badge→StatusPill, card, fields, Dashboard
tiles→Metric; replaced InvoiceForm presentation (gray island → Field/Surface); added the new
primitives; the unused `WorkStatusBadge` became a thin StatusPill wrapper.

## Risks & areas requiring special care
1. **Money correctness is sacred** — all changes presentational; math/RPCs untouched. Re-verify totals visually.
2. **Print/PDF** — invoice/DO/statement print path preserved (`InvoiceDocument` intentionally keeps its fixed print palette). Regression-test actual print output.
3. **Configurable per-lab status colours** — currently stored as Tailwind class strings, so they were mapped to semantic tones (per-stage hue no longer differs). *Follow-up:* store hex to restore per-stage colour via `StatusPill dotColor`.
4. **Dark mode** — new surface area; verified in both themes; opt-in via the rail toggle (existing users stay light).
5. **Server/client boundary** — server-first preserved.
6. **Keyboard/a11y** — table rows + Kanban made operable; keep `role=alert` on inline errors.
7. **Terminology** — grep for stray "Customer" in UI before merges.
8. **Change management** — Console is a real departure; roll out with owner feedback.
9. **Verification realism** — seeded local stack only, never prod.
10. **NestJS migration** — data contracts/`domain/schemas.ts` untouched.

## Follow-ups (not yet done)
- Verify the ProductsClient price-range toggle (Checkbox rebind to `Controller`) still swaps single↔min/max.
- Money format shifted to always-2dp via `<Money>` on migrated screens (was locale-dropped cents) — confirm acceptable.
- Optional: restore per-lab per-stage colour (store hex + `dotColor`).
- Optional: extract `Sidebar` from `AppShell`; add `Segmented`/`Collapsible` primitives; converge the Reports print-doc math; add a Clinics list balance column (needs data).
- Broader visual-regression snapshots + e2e for the redesigned flows; enable the impeccable design-detector hook.
