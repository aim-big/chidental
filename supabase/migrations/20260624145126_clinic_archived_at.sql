-- Clinic soft-delete. NULL = active; a timestamp = archived (records when).
-- No backfill (existing clinics stay active). No RLS change: writes use the
-- service-role/admin client; the existing customers UPDATE policy already gates
-- on customers.edit, so toggling archived_at is gated like any other update.
-- FK constraints unchanged — ON DELETE RESTRICT becomes an unreachable backstop
-- since we never hard-delete.
alter table public.customers
  add column if not exists archived_at timestamptz;

-- Partial index: the directory/pickers filter on the active set, which is the
-- hot path and (over time) the minority once clinics get archived.
create index if not exists idx_customers_active
  on public.customers (clinic_name)
  where archived_at is null;
