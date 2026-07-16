# Daylight Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark Console presentation with a light design system, restore the original sidebar colour, and rebuild the dashboard as a financial ledger.

**Architecture:** Global CSS variables remain the visual source of truth so established shadcn components inherit the new language. AppShell owns navigation presentation, while DashboardClient composes existing server-provided data into the new ledger layout without changing data flow.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, shadcn/ui, lucide-react, Recharts, Vitest.

## Global Constraints

- UI says “Clinic”; code, routes, and permission keys retain `customer`.
- Light-mode sidebar is exactly `#766254` and remains flush/full-height.
- Default canvas is neutral, not cream or warm beige.
- Preserve routes, permissions, server fetching, money calculations, print behavior, and configurable status colours.
- Controls retain visible focus states and 40px minimum height; status never relies on colour alone.

---

### Task 1: Theme contract and tokens

**Files:**
- Create: `apps/web/src/lib/theme-contract.test.ts`
- Create: `apps/web/src/lib/theme.ts`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/ui/theme-toggle.tsx`

**Interfaces:**
- Produces: `THEME_STORAGE_KEY = 'chidental-theme-v2'` for the pre-paint script and toggle.
- Produces: semantic workspace, rail, interaction, and status CSS variables.

- [ ] Write a test that reads `globals.css`, asserts `--rail: #766254`, asserts the neutral workspace token, and checks the v2 storage key.
- [ ] Run `pnpm test -- theme-contract.test.ts` and confirm the new assertions fail.
- [ ] Implement the tokens and shared storage key, then rerun the focused test until it passes.

### Task 2: Shared product vocabulary and app shell

**Files:**
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/metric.tsx`

**Interfaces:**
- Consumes: CSS tokens from Task 1.
- Produces: consistent flat panels, brown primary actions, and a white selected rail state.

- [ ] Restyle the flush sidebar states while preserving collapse, permission filtering, navigation, and mobile behavior.
- [ ] Align cards, controls, metrics, focus, hover, disabled, and active states with Daylight Ledger.
- [ ] Run the focused component tests and address regressions.

### Task 3: Dashboard ledger composition

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardClient.tsx`
- Modify: `apps/web/src/app/(authenticated)/dashboard/loading.tsx`

**Interfaces:**
- Consumes: existing `DashboardSummary`, `PresetMap`, permissions, and shared UI primitives.
- Produces: money ledger, production pulse, analysis split, ranked lists, and matching skeleton.

- [ ] Replace equal metric cards with the width-led financial ledger.
- [ ] Add collection-health support and ranked product/clinic lists using existing data only.
- [ ] Mirror the final composition in the loading state.
- [ ] Run dashboard tests and ensure responsive class structure preserves mobile ordering.

### Task 4: Documentation and release verification

**Files:**
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: final token and component decisions.
- Produces: one current visual source of truth.

- [ ] Update DESIGN.md from Console to Daylight Ledger and record exact tokens and layout rules.
- [ ] Run Impeccable detector on all changed UI files and resolve every result.
- [ ] Run `pnpm test`, `pnpm build`, and `git diff --check`; require zero failures.
- [ ] Open `http://localhost:6060/dashboard` after verification.

