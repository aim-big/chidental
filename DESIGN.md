# Design System — Chidental Lab  ·  "Console"

> **Source of truth for the visual system.** Colours, type, spacing, radius, borders,
> elevation, motion, layout, components, and recurring product patterns. Individual pages
> compose these tokens and components — they do not invent styles. Product truth:
> [PRODUCT.md](./PRODUCT.md). Naming/money/permissions: [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)
> (wins on terminology). Rationale for choosing "Console":
> [docs/redesign/directions.md](./docs/redesign/directions.md).

Direction: **Console** — a warm-anchored precision instrument. Near-monochrome warm-neutral
surfaces, an espresso command rail, hairlines (not stacked cards) for structure, and
**colour reserved for money/status meaning and the single primary action**. Dark mode is
first-class. Values are OKLCH (hex shown for reference only).

Implementation: tokens live in `apps/web/src/app/globals.css` as CSS custom properties,
surfaced to Tailwind v4 via `@theme inline`. We **keep the shadcn variable names**
(`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, …) so existing
components inherit the look, and **add** the semantic + layer tokens below. A `.dark {}` block
provides the dark theme; a pre-paint script in the root layout applies the stored preference.

---

## 1. Colour

### 1.1 Neutrals & surfaces (warm, hue ≈ 72)

| Token | Role | Light — OKLCH | Dark — OKLCH |
|---|---|---|---|
| `--background` | App background | `0.975 0.004 75` | `0.19 0.008 70` |
| `--card` | Tables, dialogs, raised content | `1 0 0` | `0.235 0.010 70` |
| `--surface-2` / `--muted` | Zebra/hover/inset, quiet fills | `0.985 0.004 75` / `0.965 0.004 75` | `0.275 0.011 70` |
| `--rail` | Command sidebar (espresso) | `0.28 0.014 62` | `0.155 0.007 70` |
| `--rail-foreground` | Text/icons on rail | `0.93 0.006 75` | `0.93 0.006 75` |
| `--rail-muted` | Inactive rail text | `0.72 0.010 70` | `0.66 0.010 70` |
| `--foreground` | Body / primary text | `0.24 0.012 70` | `0.94 0.004 75` |
| `--muted-foreground` | Secondary text (AA on canvas) | `0.50 0.012 70` | `0.72 0.010 75` |
| `--border` | Hairlines, dividers | `0.90 0.006 75` | `0.31 0.010 70` |
| `--input` | Field border | `0.86 0.007 75` | `0.36 0.010 70` |
| `--ring` | Focus ring | `0.55 0.07 62` | `0.66 0.06 65` |

### 1.2 Brand & primary action

| Token | Role | Light | Dark |
|---|---|---|---|
| `--brand` | Logo/identity, rail active accent, **links** | brown `0.47 0.05 62` | `0.64 0.055 65` |
| `--primary` | **Primary action** fill | espresso `0.30 0.016 62` | `0.92 0.010 75` |
| `--primary-foreground` | Text on primary | white | `0.22 0.012 70` |

> The brand brown is preserved (identity) but is **not** a CTA colour (too low-contrast).
> Primary actions use near-black espresso (light) / near-white (dark). Brand shows on the rail
> accent, links, and logo. **Links use `text-brand`, not `text-primary`.**

### 1.3 Semantic — money & status (the one authority)

Each role = a **text/emphasis tone** (`--x`), a **chip background** (`--x-subtle`), and
**chip text** (`--x-subtle-foreground`), all AA-verified on both themes. Domain mapping
(from `lib/status-badge.ts`, preserved): `paid→success`, `sent/"Issued"→info`,
`partial→warning`, `overdue/void→danger`, `draft→neutral`; work: `received→neutral`,
`in_progress→info`, `ready→success`, `delivered→neutral`, `on_hold→warning`.

| Role | Meaning | Light tone / chip |
|---|---|---|
| `--success` | paid, ready, cash received | `0.50 0.12 150` / `0.95 0.03 150` |
| `--warning` | outstanding, partial, on-hold | `0.47 0.09 70` / `0.95 0.045 78` |
| `--danger` (= `--destructive`) | overdue, void, destructive | `0.51 0.19 25` / `0.95 0.035 25` |
| `--info` | issued, in-progress | `0.50 0.11 245` / `0.95 0.03 245` |
| `--neutral` | draft, received, delivered | `--muted-foreground` / `--surface-2` |

**Money rules.** Render via `<Money>`: default ink; `success` for cash received/paid;
`warning` for outstanding; `danger` for overdue. Never inline `text-green-600`/`text-red-600`.

**Configurable per-lab colours.** Work-status/stage colours are user-editable. Where a hex is
available, `<StatusPill dotColor>` shows it as an accent dot (chip stays semantic). Where the
stored colour is a Tailwind class string (current data), the pill maps to the semantic tone.
*(Follow-up option: store hex to restore per-stage hue via the dot accent.)*

**Charts** (recharts): series use `var(--brand)` and `var(--success)` — tokens, not the
old duplicated `#766254` hex. Max 4 series; label directly where possible.

### 1.4 Contrast (WCAG AA, enforced)
Body/labels/placeholders ≥ 4.5:1; large/bold ≥ 3:1; focus ring ≥ 3:1. Status never colour
alone — always label (+ optional icon) + colour. Every token pair passes in both themes.

---

## 2. Typography
- **Family:** Hanken Grotesk (single family, no serif pairing). Numbers are the display type:
  `tabular-nums slashed-zero` (`.nums` helper) on all money/counts/ids/dates.
- **Fixed rem scale** (ratio ≈ 1.2), not fluid:

| Step | Size / weight | Use |
|---|---|---|
| `metric-hero` | 2–2.5rem / 600 tnum | the ONE dominant number per screen |
| `metric` | 1.5rem / 600 tnum | supporting metrics |
| `h1` | 1.375rem / 600 | page title (one per page) |
| `h2` | 1.125rem / 600 | section title |
| `h3` | 1rem / 600 | card/subsection |
| `body` | 0.875rem / 400 | default, table cells |
| `label` | 0.8125rem / 500 | field labels, table headers |
| `meta` | 0.75rem / 500 | hints, timestamps (floor) |

`text-wrap: balance` on h1–h2; prose ≤ 70ch; sentence case; no ALL-CAPS eyebrows; table
headers `label`-size muted, not uppercase.

---

## 3. Spacing, sizing, radius, borders, elevation
- **Spacing** — 4px base: 2·4·6·8·12·16·20·24·32·40·48·64. Vary rhythm; don't uniformly `space-y-6`.
- **Control heights** — default **h-10 (40px)** for input/select/textarea/button/combobox; sm h-9; lg h-11; icon 40². Table rows: comfortable 40px / compact 32px.
- **Radius** — `--radius: 0.5rem` → lg 8 (surfaces/cards), md 6 (controls), sm 4; pill for tags/toggles. **Cards use rounded-lg (8).** Never 16px+ on a card.
- **Borders** — hairline 1px `--border` is the default structural device. No coloured side-stripes; no border+heavy-shadow on one element.
- **Elevation** — flat by default (`--shadow-none` for content). `--shadow-sm` sticky/toolbar; `--shadow-md` menus/popovers/tooltips; `--shadow-lg` dialogs/command/toast. Warm ink. Content is organised by hairlines + whitespace, not a box+shadow around everything.
- **Z-index (semantic)** — dropdown 1000 · sticky 1100 · backdrop 1200 · modal 1300 · popover 1400 · toast 1500 · tooltip 1600.

---

## 4. Iconography
lucide-react, one library. 16px inline/labels · 18px default control · 20px nav/primary.
~1.75px stroke. Decorative icons `aria-hidden`; icon-only buttons need `aria-label` + tooltip.

## 5. Motion
- Durations 120 (micro) / 160 (state) / 220 (overlay). Easing `--ease-out-quart`
  `cubic-bezier(0.25,1,0.5,1)` for enters; plain ease for hovers. No bounce/elastic.
- State-only (change/feedback/loading). No orchestrated page-load sequences.
- `prefers-reduced-motion: reduce` → instant/crossfade for every animation.

## 6. Layout & responsive
- Espresso `--rail` sidebar (w-64 / collapsed w-20) + content. Content padding 16/20/24.
  One `max-w` per screen type: forms `max-w-2xl`, detail `max-w-5xl`, lists/tables full-width.
- Breakpoints `sm 640 · md 768 (rail; below = drawer + top bar) · lg 1024 · xl 1280`.
- Responsive is structural + editorial: each screen declares what leads on mobile (money
  screens lead with the hero number + primary action). Tables scroll inside their own
  `overflow-x-auto` container, never the page.

---

## 7. Components (the vocabulary)
Every interactive component ships default/hover/focus-visible/active/disabled/loading (+error
where it takes input). Focus is unified: `ring-2 ring-ring ring-offset-2` on all controls.

- **Button** — variants primary (espresso) / secondary / outline / ghost / destructive / link
  (brand); sizes sm/default/lg/icon; built-in `loading`.
- **Field/Input/Select/Textarea/Combobox/Checkbox/Switch** — unified h-10, radius-6, `--input`
  border, `--card` bg, unified ring. `Field` = Label(htmlFor) + control + `aria-describedby`
  error with `role="alert"`.
- **StatusPill** — the one status authority: `tone` + optional `dotColor` per-lab accent.
  Replaces Badge-misuse, the unused WorkStatusBadge (now a thin wrapper), and 4 hand-rolled pills.
- **Money** — MYR (`RM` + tnum + 2dp), coloured by semantic role.
- **Metric** — `label + value + hint`, `hero` boolean. One hero per summary zone. Replaces KpiCard/StatTile.
- **DataTable** — the single interactive table (sticky header, sortable, skeleton/empty/footer,
  keyboard row nav, `Money`/`StatusPill` cells). Print documents are the one raw-table exception.
- **Surface** — titled section with a hairline header + flat body. Use instead of stacked
  shadowed cards. Never nest.
- **PageHeader** — title + subtitle + action slot; no redundant back when a rail/breadcrumb exists.
- **Dialog / DropdownMenu / Tabs+Segmented / FilterChips / EmptyState / ErrorState / Skeleton
  / Toast / Pagination / Tooltip / Separator / PhoneInput** — one of each; adopt EmptyState/
  ErrorState everywhere; Skeletons mirror the real layout; Toast is the mutation feedback.
- **AppShell / Sidebar / ThemeToggle** — espresso rail, brand-accent active item, ⌘K search,
  collapse + mobile drawer, light/dark toggle.

## 8. Recurring product patterns
- **List** = PageHeader (title + live count + primary New) → ListToolbar → FilterChips → DataTable in one flat Surface → Pagination.
- **Detail** = PageHeader (contextual actions) → hero zone leading with the single decision number (Outstanding/Balance due) as `metric-hero` + the primary action promoted to `primary` fill → hairline-separated supporting sections → history/activity.
- **Form** = PageHeader (+ sticky actions on long forms) → labelled Surface sections (no nested boxes) → one Field recipe → inline `role=alert` errors → primary/secondary actions. Validate-all-on-submit, scroll to first error.
- **Settings** = two-pane rail (data-driven); one `<h1>` per page; one form architecture; toast success; consistent max-w.
- **Money** always `<Money>`; hero the balance; overdue in danger with a label. **Status** always `<StatusPill>`; label + colour (+ per-lab accent dot).
- **Empty/Loading/Error contract** — every list/detail ships all three; EmptyState carries its CTA; Skeleton matches layout; ErrorState / route `error.tsx` on money-critical paths.

## 9. Content & UX-writing
Terminology is law (CONVENTIONS): "Clinic" in UI / `customer` in code; "Contact person",
"Patient", "Doctor", "Product", "Line item", "Work status/stage", "Service status", "Issued"
(=sent), "Voided", "Outstanding/Balance due", "Cash Received". Sentence case. Money `RM 1,250.00`.
Actions are verbs. Errors plain/specific/announced (`role=alert`). Empty states teach + offer
the action. Irreversible actions keep typed-name confirmation.

## 10. Governance
DESIGN.md is the source of truth. New UI composes these tokens/components; new decisions are
recorded here (terminology/behaviour in CONVENTIONS). Need something new → add it to the system
first, then use it.
