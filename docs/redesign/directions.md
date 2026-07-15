# Redesign — Phase 3 & 4: Design Directions + Recommendation

> Research done with the `impeccable` **product register** method and category-leading references
> (Linear, Stripe, Notion, Ramp, Mercury, ledgers). ("UI UX Pro Max" wasn't installed in this
> environment.) All directions preserve the brand brown as heritage but stop using it as a flat
> block; all fix the Phase-1 failures (one semantic money/status system, real hierarchy, real dark
> mode, one component vocabulary).

## A — "Ledger" · quiet flat restraint
Make the current thing excellent: strip chrome, tables-as-hero, sections + hairlines not cards,
warm-neutral canvas, brand brown as a subtle ink/link accent. One family, fixed scale, numeric
hierarchy. Lighten the sidebar to a neutral rail with a slim brand accent. **Benefits:** lowest
risk, fastest, timeless. **Risks:** least distinctive — solves mechanics but little identity change.

## B — "Console" · warm-anchored precision instrument  *(recommended)*
A confident operations console: a deep **espresso command rail** (the intentional evolution of the
brown block) anchors bright, structural content where **hairlines + a strict type/number scale**,
not boxes, organise. Colour is **meaning** — near-monochrome warm-neutral surface, saturated colour
only for money/status and the single primary action. **Dark mode first-class.** Every screen leads
with the one number and one action that matter. 6/8px radii. Compact espresso rail, ⌘K, brand-accent
active state. One Field recipe; DataTable everywhere; hero Metric replaces four-equal-cards.
Crisp 120–180ms motion. **Benefits:** fixes every Phase-1 failure by construction, strong hierarchy,
distinctive-not-trendy, scales via tokens, dark included, accessible-by-default, best for repeated
all-day use. **Risks:** bigger departure (change management); the espresso/precision aesthetic needs
real craft.

## C — "Atelier" · warm editorial craft
Lean into the boutique-lab craft identity: clay/terracotta brand, true off-white, a humanist serif
display + clean sans, larger radii used sparingly, generous spacing. **Benefits:** strongest identity
& warmth. **Risks (significant here):** courts the cream/parchment AI-default; serif + generous
spacing reduce density & scanning speed in a tool used hundreds of times a week; serif numbers in
dense money tables are a legibility gamble; hardest to keep "unfussy."

## Phase 4 — Recommendation: **Direction B, "Console"**

| Criterion | A | **B** | C |
|---|:--:|:--:|:--:|
| Task efficiency (all-day repeated) | ●●● | **●●●** | ●○○ |
| Clarity (hierarchy, money legibility) | ●●○ | **●●●** | ●●○ |
| Positioning (precise, not-SaaS-loud) | ●●○ | **●●●** | ●●● |
| Scalability (tokens) | ●●○ | **●●●** | ●●○ |
| Accessibility (contrast, dark, non-colour status) | ●●○ | **●●●** | ●●○ |
| Maintainability | ●●● | **●●●** | ●●○ |
| Repeated usage | ●●○ | **●●●** | ●○○ |
| Responsive | ●●○ | **●●●** | ●●○ |

**Why B:** the only direction that maximises *both* task efficiency and identity for a money-critical
instrument — strong hierarchy, semantic money system, density-with-calm, first-class dark mode —
while preserving the brand brown (evolved into an intentional espresso rail + accent). It fixes every
Phase-1 defect by construction and scales cleanly. Adopt **A's restraint** wholesale (sections +
hairlines, ledger tables — B *is* A with a spine); borrow **C's warmth** as accent/copy/login moments
without the serif/low-density cost. Not A alone (too little identity change); not C (trades away the
scanning speed and density this product lives on; courts cream-slop).

Formalised in [../../DESIGN.md](../../DESIGN.md). The token architecture is identical for A/B/C — a
different choice only changes values + the rail treatment.
