# Work Status & Sub-Status UX Redesign

**Date:** 2026-06-24
**Status:** Approved (pending spec review)
**Scope:** Make the in-progress sub-stage a first-class, visible, filterable, and easily-changeable concept across every surface — and make it unmistakable that work status is tracked **per work item, not per invoice**.

---

## Background

Work status has two layers:

- **Top-level status** — a fixed DB enum: `received → in_progress → ready → delivered`, plus `on_hold`. Defined in `src/lib/work-status.ts`.
- **In-progress sub-stages** — dynamic rows in the `work_stages` table, only meaningful while an item is `in_progress`. The (status, stage) pair is encoded as a single string (`received` / `stage:<id>` / `in_progress` / `ready` / …) by helpers in `src/lib/work-stages.ts`.

Status is stored **per invoice line item** (each line item = one "work"/service). The recent redesign already moved the Kanban board to per-work cards.

### Problems this addresses

1. **Sub-stages are hard to *see*.** On the board the in-progress column flattens all stages into one; a drop silently clears `stage_id`. The stepper only renders on the invoice-detail page.
2. **Sub-stages can't be *filtered*.** The work-queue filter chips only filter the 5 top-level statuses.
3. **The *change* control is cramped and ambiguous.** The dropdown is a small `h-8 w-44 text-xs` pill; sub-stages are buried under a plain "In Progress" group label and don't read as ordered steps.
4. **Invoice-level status is misleading.** Three places collapse all of an invoice's works into one `dominantWorkStatus` badge, implying the invoice has a single status.

---

## Goals / Non-goals

**Goals**
- One consistent, polished status control used by board, list, and invoice detail.
- The in-progress sub-stage is visible at a glance everywhere an in-progress item appears.
- Filter the work queue down to a single in-progress sub-stage.
- One-click "advance to next step."
- Invoice-level roll-ups clearly communicate "N works with these statuses," never a single fake invoice status.

**Non-goals (deferred fast-follows)**
- Board sub-stage **swimlanes** (dragging Carving→Layering natively on the board).
- A **command-palette** status changer (searchable/keyboard popover).
- Any change to the top-level status enum, RLS, or the `updateWorkStatusAction` server action contract.

---

## The work stages (data)

The four in-progress sub-stages, in order:

1. **Custom Tray**
2. **Try In**
3. **Finalize Mill Design**
4. **Finish & Polish**

The DB already holds these four as active stages in this order. The only change is a label: **`Try-in` → `Try In`** (same stage `id`, so existing items keep their stage). `Finish & Polish` keeps its ampersand. No new stages, no reordering, no deletions.

- Applied as a one-line data update (or via the existing `/settings/work-stages` UI). Keeping the same `id` means no in-progress item is orphaned onto a retired stage.
- Stages remain fully editable/reorderable/activatable at `/settings/work-stages` — this list is the current desired state, not a hard-coded enum.

---

## Design

### 1. Shared status control — `src/components/work-status-select.tsx`

The single source of truth for changing a work item's status. Used by the work queue, the Kanban card, and the invoice-detail Work Status table, so all three render identically.

**Trigger pill**
- Larger, more legible: `h-9`, `text-sm`, wider min-width (so longer stage labels fit).
- When in-progress **on a stage**, shows the stage plus position: `Try In · 2/4`. Other statuses show their plain label. Keeps the stage/status color.

**Menu** — restructured so sub-stages read as ordered steps *inside* In Progress:

```
  ↪ Advance to Finalize Mill Design     ← primary row; only shown when a next step exists
 ──────────────────────────────────
  ● Received
  IN PROGRESS                           ← section header (muted, uppercase)
   │ ① Custom Tray
   │ ② Try In                  ✓        ← numbered + indented, connector line, ✓ = current
   │ ③ Finalize Mill Design
   └ ④ Finish & Polish
  ● Ready
  ● Delivered
  ● On Hold
```

- Numbered, indented steps with a left connector line make the hierarchy obvious.
- A check marks the current step.
- The existing `leadingItems` prop (the on-hold **Resume** option) is preserved and still renders above Received.
- Color dots retained on the fixed statuses; stage rows use their stage color.

### 2. Sub-status visibility everywhere

- **`WorkStageStepper`** (`src/components/work/WorkStageStepper.tsx`, already used on invoice detail) is reused on:
  - **Board cards** — in-progress cards show stage badge + the mini stepper.
  - **List rows** — in-progress rows show the same mini stepper.
  - **List group headers** — show the stage position (e.g. "Try In · 2 of 4").
- **Board "Set stage" prompt.** A card in In Progress **with no stage** shows a prominent `Set stage ▾` pill (opens the stage portion of the shared control). Dropping a card into the In Progress column lands it as bare in-progress and surfaces this prompt — the sub-stage is never lost silently. Cards already on a stage show the stage badge + stepper instead.
- The in-progress badge styling is unified so board, list, and detail render an in-progress item identically (label + color + position).

### 3. Filter with sub-stage drill-down — `src/components/work/WorkQueueClient.tsx`

```
 [ Active ] [ All ]   │   Received · In Progress · Ready · Delivered · On Hold
                          └─ when "In Progress" is selected, a 2nd row appears:
                             Custom Tray 3 · Try In 1 · Finalize Mill Design 0 · Finish & Polish 2
```

- Meta chips (`Active` / `All`) are visually separated from the five status chips (divider).
- Selecting **In Progress** reveals a contextual second row of **sub-stage chips with live counts**; picking one filters the queue to that single stage. Picking In Progress again (or another top-level status) collapses the sub-row.
- `FilterMode` extends from `'active' | 'all' | WorkStatus` to also include `` `stage:${id}` ``. Filtering logic: a `stage:<id>` filter matches rows where `work_status === 'in_progress' && stage_id === id`.
- Sub-stage counts are derived from the same `optimisticRows` already in the component.
- Search box unchanged.

### 4. "Advance to next" — new pure helper in `src/lib/work-stages.ts`

```ts
nextWorkStep(activeStages, work_status, stage_id):
  { work_status, stage_id } | null
```

Linear progression:
- `received` → first active stage (or bare `in_progress` if no stages configured)
- in-progress on stage *i* → stage *i+1*; on the **last** stage → `ready`
- bare in-progress (no stage) → first active stage
- `ready` → `delivered`
- `delivered` → `null` (no advance; row hidden)
- `on_hold` → `null` (the existing **Resume** action covers it; no advance row)

The menu's advance row is labeled with its resolved target (e.g. "Advance to Ready") so it's never ambiguous. Selecting it calls the same `updateWorkStatusAction` path as any other move (optimistic + auto-revert preserved). Unit-tested.

### 5. Per-work clarity — new `WorkSummaryBadge`

A shared component that replaces the raw `dominantWorkStatus → WorkStatusBadge` usage in the three invoice-level spots, so a roll-up never masquerades as a single invoice status.

- **Input:** the list of an invoice's works' top-level `work_status` values (stage detail is not needed at the invoice level).
- **Behavior** (uses the existing `summarizeWorkStatuses` helper in `src/lib/work-status.ts`):
  - 0 works → `—`
  - all works share one status → a single badge, with a count when >1: `In Progress ×3`
  - mixed statuses → **breakdown chips** in canonical order: `2 In Progress · 1 Ready`
- **Density variants:** the invoices list and detail header show the full breakdown chips; the calendar cell (very tight) shows a compact colored count form with the full breakdown in a tooltip.

**Replaces aggregate usage in:**
- Invoices list "Work" column — `src/components/invoices/InvoiceListClient.tsx`
- Invoice detail header "Work" row — `src/app/(authenticated)/invoices/[id]/page.tsx`
- Cases calendar — `src/components/work/CasesCalendar.tsx`

All other surfaces already show status per work and stay as-is (work queue, invoice-detail Work Status table + history, printed invoice).

---

## Files touched

| File | Change |
|---|---|
| `src/lib/work-stages.ts` | + `nextWorkStep()`; + a label-with-position helper for the trigger/badge |
| `src/lib/work-stages.test.ts` | + unit tests for `nextWorkStep` and the position helper |
| `src/components/work-status-select.tsx` | Trigger size + position label; numbered/indented In-Progress steps; current-step ✓; "Advance to next" row |
| `src/components/work/WorkStageStepper.tsx` | Reuse on board cards + list rows; minor variant props if needed |
| `src/components/work/WorkQueueClient.tsx` | Sub-stage drill-down filter (`FilterMode` += `stage:<id>`); stepper on rows + group headers; separated meta chips |
| `src/components/work/KanbanBoard.tsx` | Stage badge + stepper on in-progress cards; "Set stage" prompt on stage-less cards |
| `src/components/work/WorkSummaryBadge.tsx` | **New** — per-work roll-up badge / breakdown chips |
| `src/components/invoices/InvoiceListClient.tsx` | Use `WorkSummaryBadge` in the Work column |
| `src/app/(authenticated)/invoices/[id]/page.tsx` | Use `WorkSummaryBadge` in the header Work row |
| `src/components/work/CasesCalendar.tsx` | Use `WorkSummaryBadge` (compact variant) per case |
| `src/components/invoices/detail/WorkStatusEditor.tsx` | Inherits the shared control automatically; verify spacing |
| **DB data** | Relabel stage `Try-in` → `Try In` (same `id`) |

No schema/RLS/permission/server-action contract changes.

---

## Testing & verification

- **Unit:** `nextWorkStep` across every branch (received, each stage, last stage, bare in-progress, ready, delivered, on_hold, and the no-stages-configured case); the label-with-position helper. Existing `work-stages.test.ts` / `work-status.test.ts` stay green.
- **Build/typecheck:** `npm run build` clean (the `FilterMode` union change touches several spots).
- **Manual (localhost:6060):**
  - `/work` board — in-progress cards show stage + stepper; drop into In Progress shows "Set stage"; Advance moves one step.
  - `/work` list — In Progress chip reveals sub-stage chips with counts; selecting one filters; stepper on rows + headers.
  - An invoice detail — dropdown shows numbered steps + Advance; changing a single line item updates only that work.
  - Invoices list + calendar — a mixed-status invoice shows the breakdown, a uniform one shows `Status ×N`.

---

## Open questions

None outstanding. Board swimlanes and the command-palette changer are explicitly deferred.
