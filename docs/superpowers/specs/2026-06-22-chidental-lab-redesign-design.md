# Chidental-Lab — Full Redesign (Master Design Doc)

**Date:** 2026-06-22
**Author:** Tech lead (with owner)
**Status:** Draft for owner review
**Type:** Program spec (executed phase-by-phase; each phase gets its own implementation plan)

---

## 1. Problem & goal

The app works and the **backend is genuinely solid** (normalized schema, RBAC, atomic money RPCs, void audit, per-item status history). But it **feels "broken / too demo / MVP"** and is **not smooth to use**. The owner wants it to feel like a *proper dental-lab system*, with a real UI revamp and better core logic (payments, statuses, editing, printing).

Grounding facts (from the live/semi-production data):
- **Digital denture lab** (BPS/SEMCD, PMMA, flexible, printed workflow) in Malaysia (MYR, SSM).
- **Small B2B scale:** ~6 clinics, ~10–15 cases/month, 3 users, avg ~RM 1,258/case (max 6 items/case).
- **Patient + doctor filled on ~95% of invoices** → they already work case-by-case.
- **Production tracking is unused** (37/42 items still `received`) — feature exists but too clunky to drive.
- **Payments barely recorded** (RM 1,001 collected vs RM 23,910 billed; 16 invoices stuck "sent") and a **real bug**: an RM 1,000 invoice accepted an RM 1,001 payment (overpayment allowed).

## 2. Strategy (the load-bearing decision)

**Rebuild the UI, keep the backend. Add business features additively. No greenfield rewrite.**

Rationale: the "MVP feel" lives in the UI/data-fetch layer and a few missing business concepts — not in the data layer. A rewrite would discard working money-logic/RBAC/audit and risk live data for zero user-visible gain. All schema changes here are **additive** (new columns / sibling tables), never a destructive re-parenting of existing tables.

### Deliberately OUT of scope (YAGNI for this lab's size)
- No greenfield rewrite. No CAD/scanner integrations (3Shape/iTero/exocad).
- No clinic **login portal** (WhatsApp-first instead; the org already owns a wa-service).
- No double-entry/GL accounting, no automated finance charges, no credit-limit enforcement.
- No barcode QC, no multi-location, no MyInvois API integration yet (schema-ready only).

## 3. Vocabulary (one canonical naming, applied everywhere)

The current naming ("customer" / "clinic" / "name") is inconsistent. Lock this vocabulary in **UI labels and DB columns**:

| Concept | Meaning | Replaces |
|---|---|---|
| **Clinic** | the business we bill — the main entity | "customer" / `customers` |
| **Contact person** | the person-in-charge at the clinic | `contact_person` / bare "name" |
| **Doctor** | the dentist on the case | `doctor` |
| **Patient** | whose mouth the work is for | `patient` |
| **Case** | one patient's job (the invoice doubles as the case) | (today: the invoice) |
| **Invoice** | the bill for a case (also the legal e-invoice unit) | `invoices` |
| **Item** | one service/charge line on the invoice | `invoice_items` |
| **Payment** | money received against an invoice | `payments` |
| **Statement** | per-clinic monthly account rollup (later phase) | — |
| **Credit** | remake/return/goodwill adjustment (later phase) | — |

Rule: **never show a bare "name"** — it is always *clinic name*, *contact person*, *doctor*, or *patient*. Rename `customers` → `clinics` (small dataset, safe).

## 4. Core model (locked)

**1 invoice = 1 patient = 1 case. A case may have multiple service items, each tracked through production independently.**

This needs **no structural change** — `invoice_items` already carries per-item `work_status` + `stage_id` + history. A case for one patient can hold *Upper arch — in progress* and *Lower arch — ready* at once, all tied to one invoice.

```
clinics (1) ──< invoices(=cases) (n)
invoices (1) ──< invoice_items (n)        [per-item work_status, stage_id, history already exist]
invoices (1) ──< payments (n)
```

**Multi-patient-per-invoice is explicitly NOT supported** (owner confirmed: always 1 patient/invoice). If consolidated monthly invoices are ever needed, that is a future, separate decision — not now.

**Deferred:** richer case fields (FDI tooth chart, shade, material, enclosures) and **production dates** (received / deliver-by / try-in / shipped) are **deferred**. Keep the current `invoice_date` + `due_date` for now; revisit dates in a later phase.

## 5. The three status axes (all kept, right-weighted)

| Axis | Lives on | Purpose | Logic? |
|---|---|---|---|
| **Payment status** | the **invoice** | money: Draft → Sent → Partial → Paid (+ derived Overdue, + Void) | Yes — real rules (§6) |
| **Work status** | each **item** (rolled up to the case) | production tracking: Received → In Progress → Ready → Delivered (+ On Hold) | Yes — drives the board |
| **Service status** | the **invoice** | a label the lab shows/prints **to the doctor** | **No special logic** — just a managed field/enum, shown on screen + printout |

Service status stays as the existing managed catalog (label/color/sort_order) — kept simple, not a workflow axis. This is the key clarification: we do **not** retire it, we just don't over-engineer it.

## 6. Payment logic (corrected — fixes a real bug)

Today a payment can exceed the invoice total (RM 1,001 on RM 1,000). New rules:

- **A payment can never exceed the outstanding balance.** Enforced in **both** the form (validation) and the **database RPC** (authoritative), so it can't slip through either path.
- Derived status: `sum(payments) ≥ total` → **Paid**; `0 < sum < total` → **Partial**; none → **Unpaid/Sent**.
- `mark_invoice_paid` continues to settle by writing a balancing payment (never overshoots).
- A genuine overpayment/deposit is **not** forced onto one invoice — it becomes **clinic account credit** (handled in the Statements/Credits phase, §11), not here.
- `record_payment` and void stay confirm-then-server (never optimistic — they're irreversible/audited).

## 7. Cases workspace — multiple views (ClickUp-style)

The production tracker becomes a **Cases workspace** with switchable views over the same data, so we never overload one column set:

- **Board** (Kanban by work status) — drag a card to advance; writes `work_status_updated_at` + status history. A **card = the whole case** (one patient); rolled-up status = least-finished item; expand to see items.
- **List/Table** — dense, sortable, filterable, with **saved-view tabs**: *Overdue · In production · Ready to deliver · Awaiting payment · Drafts*. Removable filter chips keep the current scope legible.
- **Calendar** — by due/ship date (when production dates land in a later phase; until then, by `due_date`).

**Status updates happen without digging** — from the **board** (drag), the **list** (inline status cell), and the **top** of the case page. No more "open the invoice and scroll to the bottom."

## 8. Lists & detail layout

### Invoice/case list (default billing view)
Lead columns — **Clinic is the anchor; patient is demoted to a small subtitle, not a column**:

| # | **Clinic** (bold) · *patient (grey subtitle)* | Date | Payment status (badge) | Work status (badge) | **Total / Outstanding** (right-aligned MYR) |

Doctor, addresses, notes, service status → live on the **case detail**, not the list. Different views (Production / AR) surface different columns.

### Case detail page (editors-first)
Reordered so daily controls come **before** the printable document:
1. **Header strip**: case # · clinic · patient/doctor · the status badges (payment / work / service) + money summary (**Total / Paid / Outstanding**).
2. **Quick actions**: Record payment, advance work status, edit, print, void.
3. **Items** with per-item work status + work note + status-history timeline.
4. **Printable document** (below the working area).

## 9. Editing

- **Edit case/invoice** stays gated by the existing rules (staff edit drafts; admins edit any non-void) but is reachable from the case header, not buried.
- Editing uses the atomic `update_invoice_with_items` RPC (unchanged).
- The invoice form is rebuilt: real `<form>` (Enter-to-save), unsaved-changes guard (no silent data loss), fixed qty/price inputs (no clamp-on-keystroke; clear-and-retype works), and a **searchable clinic picker** (not a long plain dropdown).

## 10. Printing & documents

Documents the lab produces:
- **Invoice** (branded, MYR, SSM/TIN, clean line items, tax row default 0).
- **Delivery docket** (what's shipping back).
- **Work ticket** (internal, for the bench).

**Print temporary edit** *(owner to confirm interpretation)*: at print time the user opens a **print preview** and can make **temporary overrides for that printout only** — edit a line's printed description, add/hide a note, adjust who it's addressed to — **without changing the saved invoice**. The saved record is untouched; the override applies only to the generated document.

**Statements** (per-clinic monthly) are a later phase (§11), reusing the same PDF renderer.

## 11. Money maturity (later phase — additive)

- **Monthly statement** per clinic: opening balance → dated ledger (charges/payments/credits) → closing balance → A/R aging (0–30/31–60/61–90/90+) → "Net 30" footer. A **derived view**, not new infrastructure.
- **Account balance** per clinic shown on the clinic detail page.
- **Credits/adjustments** entity (remake/return/goodwill) feeding the ledger — distinct from void and from payment. Captures overpayments as credit.
- Additive customer columns: `payment_terms_days` (auto due-date), `discount_pct` (per-clinic pricing), `tin` (e-invoice readiness), WhatsApp opt-in (PDPA consent).
- Tax (SST) configurable, default 0 — rate confirmed with accountant before enabling.

## 12. Design system / UI direction

Make it **look designed-today** before adding features:
- **Design tokens** (Tailwind v4 `@theme`): one neutral scale, one brand/primary, semantic status colors (reuse existing `WORK_STATUS_COLORS`), a 5–6 step type scale, 8px spacing, tabular-nums for MYR. Applied identically across all modules so it reads as **one product**.
- **One shared DataTable** primitive (density, sticky header, right-aligned money, badge cells, hover actions, skeleton rows, true-count footer) used by every list.
- **Cmd+K** command palette (search clinics/invoices/products + quick actions).
- **Loading / empty / error states everywhere**: skeletons (not spinners), first-run-vs-no-results empty states with a CTA, recoverable error toasts with Retry.
- **Optimistic UI** with undo-toasts for reversible actions (status flips); confirm-then-server for void/payment.
- Responsive enough to glance at "what's due today" on a phone.

## 13. Architecture

- **Server-first lists**: each list page is an async Server Component reading `searchParams` (page/q/status/view) and querying Supabase with `.order().range()` + `count:'estimated'`. Replaces the current "fetch everything → filter in browser" pattern. Client components hold only filter inputs that push to the URL.
- **Streaming**: per-segment `loading.tsx` (skeleton) + `error.tsx` (retry); granular `<Suspense>`; parallel queries via `Promise.all` + `React.cache()`.
- **Mutations**: React 19 `useOptimistic` + `useActionState` for reversible actions; existing Server Actions + atomic RPCs untouched for money flows.
- **Caching**: `use cache` + tags only for rarely-changing catalogs (products, units, statuses, roles), invalidated on settings writes.
- **Forms**: one zod schema per entity shared by react-hook-form (inline errors) + the Server Action (authoritative re-validation).

## 14. Naming / column rename map (applied with the rebuild)

- Table `customers` → `clinics`; UI "Customer" → "Clinic" everywhere.
- `clinic_name` = the clinic's name; `contact_person` = contact person; never a bare "name".
- Retire/relabel any UI that says "customer".
- (Type aliases + generated types regenerated after each migration.)

## 15. Phased roadmap

Each phase is a coherent milestone with its **own implementation plan**. Order is polish-first for fastest "it got better."

- **Phase 0 — UI foundation & coherence** *(no schema change)*: design tokens, shared DataTable, loading/empty/error states, Cmd+K, convert client-fetch pages to Server Components with client-island dialogs. **← we start here.**
- **Phase 1 — Snappy data + legible money + naming**: server-side pagination/filtering, saved-view tabs, optimistic flips, clear Total/Paid/Outstanding, **fix payment overpayment bug**, rename customer→clinic, rebuild invoice form (form/guard/inputs/clinic picker).
- **Phase 2 — Cases workspace**: Board/List/Calendar views, drag-to-advance, inline + top-of-detail status updates, case-detail reorder (editors-first), service status as a simple printed field.
- **Phase 3 — Printing & editing polish**: branded invoice + delivery docket + work ticket, **print temporary edit** (print-preview overrides), edit flow polish.
- **Phase 4 — Money maturity (additive)**: statements, A/R aging, account balance, credits/remakes, payment terms, tax line, e-invoice-ready fields.
- **Later (deferred)**: production/case dates (received/try-in/ship), FDI tooth chart/shade/material/enclosures, attachments, WhatsApp notifications, public status link.

## 16. Open business questions (deferred to the phases that need them)

Captured now, answered when we reach the relevant phase — not blocking Phase 0–2:
1. Annual turnover band (decides LHDN e-invoice posture). *(Phase 4)*
2. Dental prosthetics: SST service tax vs sales tax + threshold. *(Phase 4)*
3. Do clinics pay per-invoice or lump-sum across invoices? (payment allocations) *(Phase 4)*
4. Per-clinic single discount vs per-item negotiated prices. *(Phase 4)*
5. Remake reason codes + charge policy (warranty vs chargeable). *(Phase 4)*
6. Live values of `service_status` in use (before any relabel). *(Phase 2)*
7. Brand identity (logo/colors) for the printables + primary token. *(Phase 0/3)*
8. Confirm "print temporary edit" interpretation (§10). *(Phase 3)*

## 17. Success criteria

- The app reads as **one designed product**, not five MVP screens.
- Navigation feels **instant** (skeletons, server pagination, prefetch) — no frozen screens.
- A case's status can be updated in **one action** from board/list/detail.
- **Payments cannot exceed outstanding**; money (Total/Paid/Outstanding) is legible at a glance.
- Consistent vocabulary (clinic/contact person/doctor/patient) everywhere.
- The production board is actually used (because it's no longer clunky).
