# domain/

Pure, framework-free business rules. No React, no Supabase, no I/O.
Everything here is synchronous, deterministic, and unit-tested.

- `billing.ts` — invoice billing state machine (draft→sent→partial→paid, void, overdue)
- `production.ts` — per-item production state machine (received→in_progress→ready→delivered, on_hold)
- `money.ts` — currency formatting + payment reconciliation
- `aggregation.ts` — derive an invoice's production status from its items
- `schemas.ts` — Zod schemas shared by client forms and server actions
- `permissions.ts` — permission catalogue + checks

Rule: if it needs the network, the DB, or the request, it does NOT belong here.
