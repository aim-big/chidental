# Redesign — Phase 1: Current-Product Design Audit

Evidence base: full read of the design tokens (`globals.css`), all `components/ui` primitives,
four cluster surveys (dashboard/reports/work · invoices · clinics/products · settings/auth/shared),
and live screenshots of 15 screens (desktop + mobile) against the seeded local stack. Read-only.

## TL;DR
The app was **competent, coherent-looking stock shadcn/ui with a muddy taupe accent** — generic,
flat in hierarchy, chrome-heavy, and fragmented under the hood (three table systems, two form
architectures, 4+ status-pill reimplementations, four "success greens," money colours hardcoded
per-screen, no real dark mode, loading skeletons that didn't match their pages). The biggest
product failure was **hierarchy**: on money screens the number that should dominate (balance due /
outstanding) was often the smallest, and the primary action (Record Payment) looked like everything
around it. Severity: **P0** = core-system · **P1** = cluster-level · **P2** = polish.

## 1. Visual identity
- **P1** Identity was one flat brown block (sidebar/login). Muddy, low-contrast taupe; weak CTAs.
- **P1** Read as a template, not a product. Cool canvas vs warm brand never resolved.
- **Keep:** logo, "Clinic-in-UI" clarity, restrained instinct; Reports already had real hierarchy.

## 2. Design-system consistency (P0)
- **P0** Status pill reimplemented 4+ ways; purpose-built `WorkStatusBadge` unused; Reports used a different primitive.
- **P0** Money/status colours hardcoded per-screen and contradictory (statement used `text-destructive` where detail used `text-red-600` for the same aging). No semantic tokens.
- **P0** Four different "success greens" (green-600 / green-50-700 / emerald-500 / toast green).
- **P0** No real dark mode — `@custom-variant dark` declared, no `.dark {}` block; light-only Badge palettes.
- **P0** `Card` hardcoded `rounded-xl` (off the radius token).
- **P1** `InvoiceForm` an off-system `text-gray-*` island. Focus-ring & field-shape fork (ring-1/offset-0/h-10 vs ring-2/offset-2/h-9). `BRAND_CHART` hex duplicated.

## 3. Interaction design
- **P0** Flat hierarchy + demoted primary action: invoice detail Total/Paid/Outstanding equal-weight, Record Payment `outline`; clinic detail heroed Total Billed over a tiny Outstanding; dashboard four equal KPI tiers in two idioms.
- **P1** Kanban drag-only (non-focusable cards). Validation/success feedback inconsistent (inline / toast-only / silent). 3 disclosure patterns; 3 back affordances.

## 4. Information architecture
- **Strong, kept:** single data-driven nav registry; clear settings groups.
- **P1** Double `<h1>` in settings; Admin `<h2>`. Twin screens drift (Clinics vs Products). Redundant back-arrows. Per-page max-w divergence.

## 5. Responsive
- Good bones (grids collapse, drawer, DataTable overflow). **P1** Raw detail tables overflow page on mobile; invoice status strip `grid-cols-3` on mobile.

## 6. Accessibility
- **P1** Keyboard-inaccessible table rows + Kanban; colour-only chip state; no `role=alert`/`aria-live` on inline errors/success; un-associated labels in 2 dialogs; low-contrast gray placeholders/`bg-primary/5` highlight.

## 7. Implementation quality
- **P1** Loading skeletons misrepresent pages; missing route states on invoice money paths; heavy duplication (Reports print doc, duplicate editors). **P2** EmptyState/ErrorState barely adopted; native checkbox.

## 8. "Different templates combined"
InvoiceForm gray island; KanbanBoard hand-rolled chrome; three table systems; AdminConsole
different template; BillingSettings bespoke two-column; RolesManager custom flex-list.

---

## Component inventory
Legend: Keep (restyle via tokens) · Restyle · Refactor (consolidate/API) · Replace · Delete.

**Primitives:** button (Restyle+loading) · input/select/textarea/checkbox (Restyle+unify) ·
card (Refactor: token radius + Surface variants) · badge (Refactor → StatusPill, semantic) ·
data-table (Keep+Restyle, keyboard rows) · dialog/tabs/dropdown/tooltip/separator/skeleton
(Keep+Restyle) · combobox (Refactor to field shape) · empty-state/error-state (Keep + adopt) ·
list-toolbar/filter-chips/pagination/phone-input/manage-options-link (Keep+Restyle) ·
table-actions (Restyle: semantic switch).
**Added:** StatusPill · Money · Metric · Field · PageHeader · Surface · Switch · Segmented ·
Collapsible · ThemeToggle · AppShell/Sidebar extraction.
**Feature:** AppShell (Restyle), DashboardClient (Refactor → Metric), Reports (Refactor: share
print math), Work (Refactor: StatusPill + keyboard board), lists (Keep+Restyle), InvoiceForm
(Replace/Refactor), InvoiceDetail (Refactor: hero balance), Clinic/Statement/Settings (Restyle+Refactor).

## Pattern inventory (→ one authority)
Page header → `PageHeader` · Grouping → Section + hairline (Surface), not stacked cards ·
Status → `StatusPill` · Money → `Money` + semantic tokens · Metric → one `Metric` (hero vs
supporting) · Table → `DataTable` (print-table exception) · Menu → one DropdownMenu · Segmented →
one control · Filter chips → aria-pressed · Form field → one `Field` recipe · Disclosure → one
Collapsible · Empty/Error/Loading → adopt primitives, skeletons match layout · Success → toast ·
Back → one convention.

*Continues in [directions.md](./directions.md) and [migration-plan.md](./migration-plan.md).*
