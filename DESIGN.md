# Design System — Chidental Lab · “Daylight Ledger”

> Source of truth for the visual system. Product truth lives in [PRODUCT.md](./PRODUCT.md);
> terminology, permissions, and money rules live in [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)
> and take precedence. Design rationale: [Daylight Ledger spec](./docs/superpowers/specs/2026-07-16-daylight-ledger-design.md).

Daylight Ledger is a bright, dependable operations workspace. The original Chi Dental taupe
sidebar anchors the product; the working area is neutral gray-white with crisp white surfaces.
Hierarchy comes from width, typography, whitespace, and dividers—not repeated cards or dark
chrome. Colour is reserved for brand, money, status, selection, and the primary action.

Tokens live in `apps/web/src/app/globals.css`, exposed to Tailwind v4 through `@theme inline`.
Existing shadcn names remain canonical so the product inherits one coherent system. Dark mode is
optional and persisted under `chidental-theme-v2`; changing the key intentionally resets existing
installations to the new light default once.

---

## 1. Colour

### Light foundations

| Token | Role | Value |
|---|---|---|
| `--workspace` / `--background` | App canvas | `oklch(0.975 0.004 255)` |
| `--card` | Primary work surface | `oklch(1 0 0)` |
| `--surface-2` | Quiet bands and secondary context | `oklch(0.955 0.006 255)` |
| `--foreground` | Primary ink | `oklch(0.24 0.015 255)` |
| `--muted-foreground` | Secondary ink, AA-safe | `oklch(0.47 0.015 255)` |
| `--border` | Dividers and panel outlines | `oklch(0.885 0.009 255)` |
| `--input` | Field outline | `oklch(0.83 0.012 255)` |
| `--brand` / `--rail` | Heritage taupe | `#766254` |
| `--primary` | AA-safe primary action | `#6b5749` |

The canvas is a neutral tinted toward the product’s ink hue, not cream, paper, parchment, or
beige. The large brand field is the flush sidebar. Content panels are white. Do not introduce
per-page palettes.

### Sidebar states

| Token | Role |
|---|---|
| `--rail-foreground` | Primary white rail text and icons |
| `--rail-muted` | Inactive rail text; remains readable on `#766254` |
| `--rail-hover` | Translucent white hover state |
| `--rail-selected` | Opaque white current destination |
| `--rail-border` | Translucent white separators |

Selected navigation uses white fill + brown text + `aria-current="page"`. Focus uses a 2px white
ring with a rail-coloured offset. Colour is never the sole indicator.

### Semantic colour

`success`, `warning`, `danger`, `info`, and `neutral` each provide a strong tone and a subtle chip
pair. Domain mapping remains: paid/ready → success; issued/in-progress → info; partial/on-hold →
warning; overdue/void → danger; draft/received/delivered → neutral. Status always includes a text
label and may include an icon or configured colour dot.

Money uses default ink except Cash Received/paid → success, Outstanding → warning, and Overdue →
danger. Always render MYR as `RM` with two decimal places and tabular figures.

### Contrast

Normal text, placeholders, and controls require 4.5:1; large text 3:1; focus and essential glyphs
3:1. Verify light and optional dim themes independently.

---

## 2. Typography

Hanken Grotesk is the single family for headings, labels, controls, body text, and data. Fixed
product scale:

| Role | Size / weight |
|---|---|
| Decision value | 2–2.25rem / 600 / tabular |
| Page title | 1.5rem / 600 |
| Section title | 1rem / 600 |
| Supporting metric | 1.25–1.5rem / 600 / tabular |
| Body / table | 0.875rem / 400 |
| Label | 0.8125rem / 500 |
| Meta | 0.75rem / 500 |

Use `tracking-[-0.02em]` only on page titles. Body copy is 1.5 line-height and limited to 65–75ch.
Money, counts, identifiers, and dates use `.nums` (`tabular-nums slashed-zero`).

---

## 3. Structure

- 4px base spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Controls: 40px default, 36px small, 44px large. Icon-only targets remain at least 40px and
  should provide a 44px effective mobile target where relevant.
- Radius: 8px panels, 6px controls, 4px small details; pills only for tags/toggles.
- Content panels use either a 1px border or a shadow, never a decorative wide shadow plus border.
- Standard content is flat. `shadow-md` and above are reserved for menus, popovers, dialogs,
  command palette, and toasts.
- No nested cards, coloured side stripes, glass decoration, gradient text, decorative grid
  backgrounds, or identical icon-card grids.

---

## 4. App shell and responsive behavior

Desktop uses the flush `#766254` sidebar at 256px expanded / 80px collapsed. The main workspace is
neutral, centers at a maximum of 1600px, and uses gutters of 16/24/32px. Below 768px the sidebar
becomes the existing drawer and the logo moves to the top bar.

Core navigation always has icon + label when expanded. Search is visible and opens the command
palette. Settings and account actions remain separated from daily work. Permission filtering and
deep-link guards share the navigation registry.

Tables may scroll horizontally inside their own container; the page must not. Mobile composition
puts the decision value and primary action first. Verify 375, 768, 1024, and 1440px widths.

---

## 5. Components

- **Button:** primary brown, secondary, outline, ghost, destructive, and link; clear hover, active,
  focus, disabled, and loading states.
- **Fields:** visible labels, 40px controls, white surface, `--input` border, 2px focus ring, inline
  error with `aria-describedby` and `role="alert"`.
- **Card:** a generic flat 8px bordered panel. Prefer larger semantic sections over repeated cards.
- **Metric:** label + exact value + hint; one decision value may lead a screen but never as a
  decorative gradient hero.
- **StatusPill:** the single status vocabulary; semantic text + fill with optional configured dot.
- **DataTable:** sticky sortable header, exact money/status cells, skeleton, empty state, footer,
  and accessible row navigation.
- **DateRangePicker:** one segmented range control plus explicit applied dates; custom dates commit
  together.
- **Dialog / Dropdown / Tooltip / Toast:** portalled overlays, semantic elevation, predictable
  Escape/focus behavior, and clear close affordances.
- **Skeleton:** mirrors final information geometry; never a generic centered spinner for page load.

---

## 6. Dashboard pattern

The dashboard follows this order:

1. Header and primary action.
2. Date control with exact range.
3. Full-width financial ledger: Outstanding leads by width; Sales, Cash Received, and Invoices
   Issued support it behind dividers.
4. Production pulse: four work states in one compact band.
5. Analysis split: trend chart + Collection health summary.
6. One ranked-detail panel for Products and Clinics.
7. Quiet operational context footer.

This is the reference composition for decision-led summary screens. Do not regress to four equal
KPI cards.

---

## 7. Motion and accessibility

State transitions use 150–200ms; overlays may use 220ms with `ease-out-quart`. Motion communicates
hover, selection, loading, disclosure, or overlay hierarchy only. `prefers-reduced-motion: reduce`
must disable non-essential animation.

All functionality is keyboard-operable. Icon-only controls need accessible names and tooltips.
Heading order is sequential. Charts provide a text summary/accessible label and exact tooltips.
Loading, empty, error, and disabled states are deliberate parts of every reusable component.
