# Product — Chidental Lab

> Source of truth for *what this product is and who it serves*. The visual system lives in
> [DESIGN.md](./DESIGN.md). Naming, money, and permission rules live in
> [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) (that file wins on any terminology/behaviour conflict).

## Register
`product` — design **serves** the task. Earned familiarity over novelty. The tool disappears
into the work. (Not a brand/marketing surface.)

## Product purpose
Chidental (Chi Dental Lab) is the operating system for a dental-prosthetics lab. It tracks work
orders received from dental clinics through production, prices and issues invoices, records
payments, produces clinic statements, and reports on sales, cash collected, and outstanding
balances. **Success = staff can see the state of the lab — money owed, jobs on the floor,
what's overdue — at a glance, and act without hunting.**

## Target users
A small-to-mid dental lab in Malaysia (MYR / "RM"). Three overlapping roles, all
**desktop-primary, all-day, in-and-out between physical production tasks**:
- **Owner / manager** — Dashboard, Reports, clinic balances; chases outstanding money;
  configures the lab (Settings). Power user.
- **Front desk / admin** — creates invoices, records payments, prints statements/delivery
  docs, manages clinics. High-frequency data entry.
- **Technicians / shop floor** — move jobs through work statuses on the Work board/queue;
  `invoices.view` only (no billing rights).

Permissions are tiered and enforced server-side (CONVENTIONS §4). The UI degrades gracefully
when a role can't see a section — nav items and actions hide.

## Primary workflows (rough frequency order)
1. **Move work through production** — Work queue/Kanban; per-line-item work status
   (received → in_progress → ready → delivered, + on_hold). Highest daily touch.
2. **Create & issue an invoice** — pick clinic, add line items, set dates, issue. Core money-in;
   the New/Edit form is the most component-heavy screen.
3. **Record a payment / collect** — open an invoice, record against the balance due.
4. **Check the money picture** — Dashboard (today) and Reports (period: invoiced / cash / outstanding, by clinic, by product, aging).
5. **Chase a clinic** — open a clinic, see what it owes and aging, print a statement, message via WhatsApp/email.
6. **Manage catalogue & clinics** — products/services and clinic records (CRUD).
7. **Configure the lab** — Settings: billing, lab taxonomies (service/work statuses, stages, units), employees, roles, admin console.

## Most frequently used screens
`/work` · `/invoices` (list + detail) · `/invoices/new` · `/dashboard` · `/customers` (Clinics)
list + detail. These five carry the redesign.

## Business priorities
1. **Money is unambiguous and correct** — balance due, paid, outstanding, overdue, voided;
   never in doubt, never mis-coloured, always tabular. Trust is the product.
2. **Speed of repeated tasks** — the same 4 things hundreds of times a week; fewer clicks,
   obvious next action, keyboard-friendly.
3. **State legibility** — every screen answers "what's the situation, and what do I do about it."
4. **Reliability & maintainability** — one small team; a tokenised system beats per-screen cleverness.

## Desired product personality
**Dependable, clear, unfussy.** Calm and precise — a professional instrument, not a marketing
surface. Confident, not loud. Warm at the edges (a Malaysian craft business) but the warmth lives
in the brand and copy, never in chrome that slows the task.

## Anti-references
Loud gradient SaaS dashboards; generic KPI-card grids (four equal cards); consumer-fintech
gamification; cream/sand/parchment "warm-minimal" AI-default palettes.

## Content & data density
Dense where it earns it (tables, Kanban, taxonomies): comfortable-dense rows, sticky headers,
right-aligned tabular money. Airy where orienting (dashboard summary, empty states, forms).
Money always `tabular-nums`, MYR, `RM`, 2dp. Data volume is modest (one lab) — optimise for
clarity and speed per item, not million-row virtualisation.

## Technical constraints
Next.js App Router, server-first (page.tsx fetches + gates; client islands render; no client
fetch for first paint — redesign is presentational, keep the split). Tailwind v4 (`@theme inline`
in `apps/web/src/app/globals.css`) + shadcn/ui + class-variance-authority; lucide-react; recharts;
react-hook-form + zod; @react-pdf/renderer + print CSS. Font Hanken Grotesk. App on localhost:6060;
Vercel root `apps/web`. Gates: `npm run build` + `npm test` only. Verify against the seeded local
Supabase stack (`seedowner` / `123456`) — never prod.

## What must NOT change (preserve)
Routes & URLs (`/customers` stays `customers`), server data flow, RPCs, RLS, permission tiers,
money math, void/soft-delete semantics, audit logging. Terminology per CONVENTIONS ("Clinic" in
UI / `customer` in code; the label glossary; MYR; Issued/Voided/Outstanding/Cash Received; Work
stages vs status vs Service status). Configurable per-lab data (work-status colours/labels,
service statuses, stages, units) — the visual system must accommodate arbitrary status colours.
Print/PDF documents keep printing correctly. The IA (data-driven nav registry, settings two-pane,
permission-gated) is sound — keep it, restyle its presentation.

## Design principles
- **Hierarchy over uniformity** — the decision number is bigger than the rest; never four equal cards.
- **State at a glance, next action obvious.**
- **Density with calm** — dense tables, quiet chrome; whitespace + hairlines group, not a box around everything.
- **One vocabulary** — same button/field/status pill/table/empty/loading/error everywhere.
- **Money is exact & unmistakable** — tabular MYR, one semantic colour system, label + colour.

## Accessibility & inclusion (non-negotiable)
WCAG AA (body ≥ 4.5:1, large ≥ 3:1, placeholders too); no status by colour alone. Full keyboard
operability (incl. table rows and the Kanban board); visible focus rings; associated labels +
`aria-describedby` errors; `role="alert"` on validation/success; `prefers-reduced-motion` path for
every animation. Dark mode is a first-class target (DESIGN.md), user-toggleable.
