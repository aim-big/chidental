# Product

> Inferred from the codebase by `impeccable init` (no interview yet). Refine any section that's off.

## Register

product

## Users

Dental-lab staff — owners, technicians, and front-desk/admin — running a small-to-mid dental prosthetics lab. They work in the system throughout the day on desktop, between production tasks: logging incoming work from clinics, moving jobs through stages, issuing invoices and statements, recording payments, and chasing outstanding balances. Their counterparties are dental clinics — the UI always calls them **"Clinics"** while the code/DB/routes call them `customer`.

## Product Purpose

Chidental (Chi Dental Lab) is a lab-management system: it tracks work orders from clinics through production stages, manages products and pricing, issues invoices and statements, records payments, and reports on sales, cash collected, and outstanding balances. Success is when staff can see the state of the lab — money owed, jobs on the floor, what's overdue — at a glance and act without hunting.

## Brand Personality

Calm, precise, trustworthy. Operational software that gets out of the way — a quiet professional tool, not a flashy SaaS marketing surface. Three words: **dependable, clear, unfussy.**

## Anti-references

- Loud, gradient-heavy SaaS marketing dashboards.
- Generic admin templates: identical KPI card grids, the "big number + tiny label" hero-metric block repeated four across.
- Consumer-fintech gamification (confetti, streaks, badges, mascots).

## Design Principles

- **Hierarchy over uniformity.** The number that drives a decision is bigger than the ones that don't; not four equal cards.
- **State at a glance, next action obvious.** Every screen answers "what's the situation, and what do I do about it."
- **Density with calm.** Dense where staff need it (tables, stages), airy where they're orienting.
- **Consistency screen-to-screen.** Same button, same controls, same status vocabulary everywhere; delight in moments, never in the way of the task.
- **Money is exact.** Tabular numerals, MYR (RM), unambiguous status (paid / outstanding / overdue).

## Accessibility & Inclusion

- WCAG AA: body text ≥ 4.5:1, large text ≥ 3:1. Status is never color alone — always icon/label + color.
- Full keyboard operability, visible focus rings, and a `prefers-reduced-motion` path for every animation.
