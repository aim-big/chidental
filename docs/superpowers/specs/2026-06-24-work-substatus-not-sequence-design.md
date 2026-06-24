# In-Progress Sub-Status: Label, Not Sequence

**Date:** 2026-06-24
**Status:** Approved (pending spec review)
**Supersedes:** §1 (trigger/menu), §2 (stepper), and §4 (`nextWorkStep`) of
[`2026-06-24-work-status-substatus-ux-design.md`](./2026-06-24-work-status-substatus-ux-design.md).
§3 (sub-stage drill-down filter) and §5 (invoice-level removal) of that spec stand unchanged.

---

## Why

The first pass rendered the in-progress work stages as a **numbered linear pipeline**:
trigger pill `Try In · 2/4`, a connected-dots stepper with done-fill and an
`In Progress · 2 of 4` caption, dropdown steps `①②③④` under a connector tree, and a
one-click `↪ Advance to <next stage>` row that walked the stages in `sort_order`.

That framing is wrong for the shop floor. A case's stage is **which sub-status of
"In Progress" it's in** — not how far along a fixed assembly line it is. Cases bounce
between stages (remakes, adjustments, skips); a stage being "current" says nothing about
whether the others are done. Rendering `2/4` and filling earlier dots lies about a
pipeline that doesn't exist.

**New model:** an in-progress stage is a **labeled sub-status**. There is a *display*
order (so lists read sensibly and stay stable) but **no progress, no "done", no count**.

---

## Design

### 1. Labels — sub-status, not position

Replace the position suffix with a sub-status label.

- New pure helper in `src/lib/work-stages.ts` (replacing `workLabelWithPosition`):

  ```ts
  // "In Progress · Try In" when staged; the plain work label otherwise.
  workSubStatusLabel(work_status, stage_id, stagesById, statusConfigs): string
  ```

  - in-progress **on a stage** → `In Progress · <stage label>` (e.g. `In Progress · Try In`)
  - bare in-progress (no stage) → `In Progress`
  - every other status → its plain label (`Received`, `Ready`, `Delivered`, `On Hold`)

- The middle-dot `·` separator is kept (it now joins status + sub-status, not status + count).
- The trigger pill / badge keeps the **stage's color** when staged.
- `stageProgress()` and the `· N/total` formatting are **removed** from the label path.
  `stageProgress` may remain only if still needed to compute which chip is current
  (see §2); its `total`/count is no longer surfaced to users.

### 2. Chip row — replaces the stepper

Rename/replace `src/components/work/WorkStageStepper.tsx` →
`src/components/work/WorkStageChips.tsx` (the old name implies sequence). It renders the
active stages as a row of **equal chips**:

- The **current** stage chip is highlighted (its stage color, as a filled pill).
- **Every other** chip is identical: muted/neutral (`bg-gray-100 text-gray-500`),
  regardless of display order — **passed and upcoming stages look the same**.
- **No connector line. No done-fill. No "X of N" caption.**
- Renders nothing unless the item is `in_progress`. A bare in-progress item (or one on a
  retired stage) shows the chips with **none** highlighted, captioned simply `In Progress`.

Used on board cards, list rows, and list group headers — the same component everywhere, so
an in-progress item reads identically across surfaces.

> Chips are **display-only** here; the dropdown remains the single place to *set* a stage.
> (Clickable chips that jump straight to a stage are a deferred fast-follow.)

### 3. Dropdown menu — flat sub-status options

In `src/components/work-status-select.tsx`, the In-Progress group becomes plain colored
stage pills — **no numbering, no connector tree, no advance-stage row**:

```
 ──────────────────────────────────
  ● Received
  IN PROGRESS                          ← section header (muted, uppercase)
   No sub-status                        ← clears the stage → bare in_progress
   Custom Tray
   Try In                     ✓        ← stage-colored pill; ✓ = current sub-status
   Finalize Mill Design
   Finish & Polish
  ● Ready
  ● Delivered
  ● On Hold
```

- Each stage row is its stage-colored pill; a ✓ marks the current sub-status.
- A leading **"No sub-status"** row (neutral/muted, encodes to bare `in_progress`) lets a user
  put an item *in* In Progress without committing to a stage, and lets them **clear** a stage
  back to bare in-progress. ✓ marks it when the item is bare in-progress. This is the only way
  today to remove a sub-status once set.
- The `IN PROGRESS` header stays so the rows clearly read as sub-statuses *of* In Progress.
- The `leadingItems` prop (the on-hold **Resume** row) is preserved, still above Received.
- The `ADVANCE_VALUE` sentinel + the "Advance to <next stage>" primary row are **removed**
  from this control (see §4 for what replaces the advance action).

> **Bare in-progress is a first-class state.** Its label is the plain `In Progress` (never a
> blank pill); its chip row renders with no chip highlighted. It is what `received → advance`
> lands on, and what the board "Set stage" prompt then resolves.

### 4. `nextWorkStep` — top-level transitions only

The advance helper stops walking stages. It only moves the **top-level** status:

```ts
nextWorkStep(work_status): { work_status; stage_id } | null
  received     → { in_progress, stage_id: null }   // bare; user then picks the sub-status
  in_progress  → { ready,       stage_id: null }    // any stage (or none) → Ready
  ready        → { delivered,   stage_id: null }
  delivered    → null
  on_hold      → null                               // Resume covers it
```

- No longer depends on `activeStages` or the current `stage_id`.
- Advancing `received → in_progress` lands the item as **bare in-progress**, which triggers
  the existing board **"Set stage"** prompt — the sub-status is an explicit pick, never
  auto-assigned to "stage 1".
- Wherever a one-click advance is surfaced (board card action), it advances the top-level
  status using this helper. Setting a specific sub-stage is always done via the dropdown.

### 5. Settings config — `/settings/work-stages`

The page stays (CRUD + reorder + activate/retire), but its copy is reframed from
"steps/sub-steps in a sequence" to "sub-statuses with a display order." The noun **Work
stages** is kept (it's the established term in `docs/CONVENTIONS.md`).

- **Subtitle:** `Sub-steps shown inside the In Progress work status.` →
  `Sub-statuses of "In Progress". The order here is display order only — it does not mean a case must move through them in sequence.`
- **"Order" column:** keep the up/down reorder controls, but its meaning is *display order*
  (how stages list in the dropdown, chip rows, and filter). Add a small `Display order`
  hint (column header tooltip or a one-line caption) so admins don't read it as a workflow
  sequence.
- **Dialog placeholder:** `e.g. Try-in` → `e.g. Try In` (matches the relabel).
- Reorder/activate/retire behavior, the color presets, and the `work_stages` schema are all
  unchanged. `sort_order` continues to drive list order everywhere via `fetchWorkStages()`.

Also update `docs/CONVENTIONS.md` §5: the line "In Progress has sub-stages" should clarify
that stages are **sub-statuses with a display order, not a required sequence**, and that an
in-progress item may sit on **no** sub-status (bare `in_progress`).

### Unchanged from the prior spec

- **§3 drill-down filter** — selecting "In Progress" still reveals sub-stage chips with live
  counts; `matchesWorkFilter` still treats `stage:<id>` as a categorical match
  (`work_status === 'in_progress' && stage_id === id`). This was already categorical, not
  sequential — it survives as-is.
- **§5 invoice-level removal** — work status remains per service item, never aggregated to
  the invoice. No re-introduction.
- The four stages and their labels (`Custom Tray`, `Try In`, `Finalize Mill Design`,
  `Finish & Polish`) and the per-item server-action contract are unchanged.

---

## Files touched

| File | Change |
|---|---|
| `src/lib/work-stages.ts` | Replace `workLabelWithPosition` → `workSubStatusLabel` (no count); simplify `nextWorkStep` to top-level only; drop the count from `stageProgress` usage |
| `src/lib/work-stages.test.ts` | Update tests: `workSubStatusLabel` cases; simplified `nextWorkStep` branches (received/in_progress/ready/delivered/on_hold) |
| `src/components/work/WorkStageStepper.tsx` → `WorkStageChips.tsx` | Rename; equal chips with only current highlighted; remove connector line, done-fill, and `X of N` caption |
| `src/components/work-status-select.tsx` | Flat stage pills under "In Progress" (no numbers/connector); remove `ADVANCE_VALUE` row; trigger uses `workSubStatusLabel` |
| `src/components/work/KanbanBoard.tsx` | Use `WorkStageChips`; advance button uses simplified `nextWorkStep`; "Set stage" prompt unchanged |
| `src/components/work/WorkQueueClient.tsx` | Swap stepper → chips on rows + group headers; group-header caption uses `workSubStatusLabel` |
| `src/components/invoices/detail/WorkStatusEditor.tsx` | Inherits shared control + chips automatically; verify spacing |
| `src/app/(authenticated)/settings/work-stages/page.tsx` | Reframe subtitle + "Order" column copy to display-order; `Try-in` → `Try In` placeholder |
| `docs/CONVENTIONS.md` (§5) | Clarify stages are sub-statuses w/ display order, not a sequence; bare in-progress is valid |
| Callers of `workLabelWithPosition` / `WorkStageStepper` / `ADVANCE_VALUE` | Update imports/usages to the renamed/replaced symbols |

No schema / RLS / permission / server-action contract changes.

---

## Testing & verification

- **Unit:** `workSubStatusLabel` (staged, bare, non-in-progress); `nextWorkStep` across all
  five statuses. Existing `work-stages.test.ts` / `work-status.test.ts` updated and green.
- **Build/typecheck:** `npm run build` clean (renamed helper + removed sentinel touch
  several call sites).
- **Manual (localhost:6060):**
  - `/work` board — in-progress cards show `In Progress · <stage>` + the equal chip row
    (only current highlighted, no count); Advance moves received→in_progress→ready→delivered;
    bare in-progress shows "Set stage".
  - `/work` list — In Progress chip still reveals sub-stage filter chips with counts;
    rows + group headers show the chip row, no `X of N`.
  - Invoice detail — dropdown shows flat sub-status pills (no numbers, no advance-stage row);
    changing one line item updates only that work.

---

## Open questions

None outstanding. Clickable chips (tap a chip to set that sub-status) and board sub-stage
swimlanes remain deferred fast-follows.
