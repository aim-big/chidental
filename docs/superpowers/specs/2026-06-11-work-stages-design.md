# Work Stages (In-Progress sub-steps) — Design

**Date:** 2026-06-11
**Status:** Approved, pending implementation plan

## Problem

Every invoice line item carries a single `work_status` from a hardcoded Postgres enum:
`received → in_progress → qc → ready → delivered`, plus `on_hold`. The lab tracks each
piece of work through these stages on the **Work Queue** page.

The stakeholder wants two changes:

1. **Remove `qc`** — it is not used in their process.
2. **Break "In Progress" into the real bench steps** — Custom Tray, Monoblock Try-in /
   Try-in, Finalize Mill Design, Finish & Polish — so the queue shows *where inside
   production* a piece actually is, not just the catch-all "In Progress".

The deeper requirement (raised by the product owner): **the steps will change over time,
and eventually different kinds of work may need different steps.** The design must absorb
those changes without a developer and without destabilising reporting.

## Approach chosen

Two layers:

- **Phases** — a small, stable, code-defined backbone. Rarely changes. Everything
  cross-cutting (dashboard, filters, "where's my order", reports) keys off the phase.
- **Stages** — the editable detail that lives *inside* the "In Progress" phase. Managed by
  the lab in Settings, exactly like the existing **Service Statuses** screen.

For this iteration, **one shared stage list applies to all work** (not per-work-type). The
per-work-type upgrade is designed for but not built — see [Future](#future-per-work-type-workflows).

This was chosen over (a) a flat single enum (would force a developer to change steps and
mixes unrelated work-type steps into one list) and (b) full per-work-type workflow
templates now (more schema + a product→workflow mapping + heavier UI than the stakeholder
asked for today).

## Non-goals

- **No per-work-type step lists yet.** One shared list of stages for all items. (Future.)
- **No branching / parallel / conditional steps.** Stages are a simple ordered list.
- **No change to the phase backbone beyond removing `qc`.** Received / In Progress / Ready /
  Delivered / On Hold stay code-defined.
- **No change to Service Statuses.** That is a separate concept (lab-to-doctor instruction
  printed on delivery notes) and is untouched.

## Model

### Phases (code-defined, stable)

`WorkStatus` enum after this change: `received`, `in_progress`, `ready`, `delivered`,
`on_hold`. **`qc` removed.** No other phase changes.

### Stages (DB-backed, lab-editable)

A new table mirroring `service_statuses` in shape and management UX. Stages are the
sub-steps of the **In Progress** phase only; a stage is meaningless for any other phase.

**`work_stages`**
- `id` (uuid, pk, default `gen_random_uuid()`)
- `label` (text, e.g. "Custom Tray")
- `color` (text, nullable — same Tailwind pill presets as `service_statuses`)
- `sort_order` (int — defines step order within In Progress)
- `is_active` (boolean — hide a stage without deleting history that references it)
- `created_at` (timestamptz, default `now()`)

Seeded (active, in order):

| sort_order | label |
|-----------:|-------|
| 10 | Custom Tray |
| 20 | Try-in |
| 30 | Finalize Mill Design |
| 40 | Finish & Polish |

("Try-in" covers the stakeholder's "Monoblock Try-in / Try-in".)

### Line item gets a stage pointer

**`invoice_items`**
- New column `stage_id` (uuid, nullable, fk → `work_stages(id)` **ON DELETE SET NULL**).
- Only meaningful when `work_status = 'in_progress'`. For every other phase it is `null`.

The pair `(work_status, stage_id)` fully describes where a piece is. Soft-deleting a stage
(`is_active = false`) is the normal way to retire it; hard-deleting one nulls the pointer on
any item still referencing it (those items remain "In Progress" with no specific stage).

## Behaviour

### Work Queue — one flattened dropdown

The per-item status control presents a single ordered list. Underneath, selecting a stage
sets phase + stage atomically:

```
Received                 → work_status='received',    stage_id=null
  Custom Tray            → work_status='in_progress',  stage_id=<custom tray>
  Try-in                 → work_status='in_progress',  stage_id=<try-in>
  Finalize Mill Design   → work_status='in_progress',  stage_id=<finalize mill design>
  Finish & Polish        → work_status='in_progress',  stage_id=<finish & polish>
Ready                    → work_status='ready',        stage_id=null
Delivered                → work_status='delivered',    stage_id=null
On Hold                  → work_status='on_hold',      stage_id=null
```

Only **active** stages are offered. If an item currently sits on a now-inactive stage, that
stage is still shown for *that* item (so its state reads correctly) until it is moved off.

### Work Queue — grouping

The queue groups items by their position in the same flattened order: a `Received` group,
then one group **per active In-Progress stage** (so "3 items waiting at Try-in" is visible
at a glance), then `Ready`, `Delivered`, `On Hold`. Stage groups order by `sort_order`.

The "Active" filter (everything except `delivered`) and the existing per-phase chips are
unchanged in meaning — phase-level reporting is untouched by stages.

### History & timestamps (DB triggers)

Two existing triggers on `invoice_items` gate on `work_status` changing. Both extend to also
react to `stage_id` changing:

- **`log_invoice_item_status_change()`** (writes `invoice_item_status_history`):
  - Add `stage_id` to its `INSERT`.
  - Fire when `work_status` **or** `stage_id` is distinct from the old row (plus on INSERT).
  - Net effect: moving Custom Tray → Try-in writes a history row, giving a full bench audit
    trail of who moved what, when.
- **`stamp_invoice_item_work_status_updated_at()`** (stamps `work_status_updated_at`):
  - Also stamp when `stage_id` changes, so the queue's "moved Xm ago" and its
    `work_status_updated_at` sort stay correct when a piece moves between stages.

**`invoice_item_status_history`** gains a nullable `stage_id` column (fk → `work_stages`,
ON DELETE SET NULL) recording which stage applied at that moment.

## Migration & seed

1. **Drop `qc` from the `work_status` enum.** It is used by two columns
   (`invoice_items.work_status`, `invoice_item_status_history.status`) and there are **zero
   `qc` rows** today (all 36 items are `received`). Recreate the type cleanly:
   - create `work_status_new` as (`received`, `in_progress`, `ready`, `delivered`, `on_hold`);
   - `ALTER TABLE … ALTER COLUMN … TYPE work_status_new USING <col>::text::work_status_new`
     for both columns (safe — no `qc` rows; if any appeared, map them to `in_progress` first);
   - reset the `invoice_items.work_status` default to `'received'::work_status_new`;
   - drop the old type and rename `work_status_new` → `work_status`;
   - recreate the two trigger functions (they reference the type).
   - *Fallback if the recreation proves fiddly:* leave `qc` as a dead value in the enum and
     simply stop referencing it in code. Chosen approach is the clean recreation since there
     is no data to preserve.
2. **Create `work_stages`** and seed the four rows above.
3. **Add `invoice_items.stage_id`** (nullable fk, ON DELETE SET NULL). Existing items are all
   `received`, so `stage_id` stays `null` — no backfill needed.
4. **Add `invoice_item_status_history.stage_id`** (nullable fk, ON DELETE SET NULL).
5. **Update the two triggers** as described above.

## Affected files (from current codebase)

- `src/lib/database.types.ts` — remove `'qc'` from `WorkStatus`; add `WorkStage` type and
  `invoice_items.stage_id`; add `work_stages` table entry; add `stage_id` to
  `InvoiceItemStatusHistory`.
- `src/lib/work-status.ts` — drop `qc` from `WORK_STATUSES`, all four color/label maps,
  `DOMINANT_PRIORITY`, and `LINEAR_FLOW`. `nextWorkStatus`/`dominantWorkStatus` stay
  phase-level (stage-agnostic).
- `src/lib/work-stages.ts` *(new)* — `fetchActiveWorkStages()` + helpers to build the
  flattened phase+stage dropdown list and to map a selection back to
  `{ work_status, stage_id }`. (Mirror of `src/lib/service-status.ts`.)
- `src/app/(authenticated)/work/page.tsx` — load stages; render the flattened dropdown;
  group by phase + stage; remove the `qc: 0` counts entry; write `{ work_status, stage_id }`
  on change.
- `src/components/work-status-badge.tsx` — likely **no change needed**: it already accepts
  `children` + `className`, so an In-Progress item can render its stage label/color at the
  call site (the badge shows the stage, not just "In Progress").
- `src/app/(authenticated)/invoices/[id]/page.tsx` — item status control + history list show
  the stage; `updateWorkStatus` writes `stage_id`.
- `src/app/(authenticated)/settings/work-stages/page.tsx` *(new)* — Work Stages manager,
  cloned from `settings/service-statuses/page.tsx` (add / edit / reorder / activate).
- `src/app/(authenticated)/settings/page.tsx` — add a "Work Stages" entry (gated by the same
  permission as Service Statuses).
- DB migration — drop `qc` from enum; create `work_stages` + seed; add `invoice_items.stage_id`
  and `invoice_item_status_history.stage_id`; update both triggers.

## Future: per-work-type workflows

When the lab needs a Denture and a Crown to follow *different* step lists, this model
upgrades cleanly without reworking the phase backbone or the history design:

- Introduce `workflows` (named templates) that own an ordered set of `work_stages`
  (`work_stages` gains a nullable `workflow_id`; today's flat list is the single default
  workflow).
- `products` gain an optional `workflow_id`; a line item inherits its product's workflow and
  the Work Queue dropdown offers only that workflow's stages. Items with no product / no
  mapped workflow fall back to the default list.
- Phases, the flattened-dropdown UX, history, and timestamp triggers all stay as designed —
  only *which* stages are offered to a given item changes.

This is intentionally **not** built now.
