-- Per-invoice activity / audit timeline. APPEND-ONLY. Written ONLY via the
-- service-role admin client inside permission-gated server actions
-- (logInvoiceActivity). Mirrors admin_audit_log: RLS enabled, NO client policy,
-- and NO foreign keys (so a purged invoice's history survives, and the FK cascade
-- can't fire a forbidden UPDATE on this append-only table). Reads go through gated
-- server functions using the admin client.
create table if not exists public.invoice_activity_log (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid,                       -- plain uuid, no FK (survives purge)
  actor_id     uuid not null,              -- plain uuid, no FK (mirrors admin_audit_log)
  actor_name   text not null,              -- snapshot of profiles.full_name / username
  action       text not null,              -- e.g. 'invoice.issued', 'payment.recorded'
  entity_label text,                       -- snapshot of invoices.invoice_number
  changes      jsonb,                      -- [{field,label,from,to}] for edits; null otherwise
  reason       text,                       -- void/delete reasons
  metadata     jsonb,                      -- extra structured context
  created_at   timestamptz not null default now()
);

create index if not exists idx_invoice_activity_log_invoice
  on public.invoice_activity_log (invoice_id, created_at desc);
create index if not exists idx_invoice_activity_log_created_at
  on public.invoice_activity_log (created_at desc);
create index if not exists idx_invoice_activity_log_actor
  on public.invoice_activity_log (actor_id, created_at desc);

alter table public.invoice_activity_log enable row level security;
-- No policies on purpose: only the service role (admin client) may read/write.

-- Append-only: block UPDATE/DELETE even for the service role.
create or replace function public.prevent_invoice_activity_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'invoice_activity_log is append-only';
end;
$$;

drop trigger if exists trg_invoice_activity_log_immutable on public.invoice_activity_log;
create trigger trg_invoice_activity_log_immutable
  before update or delete on public.invoice_activity_log
  for each row execute function public.prevent_invoice_activity_mutation();

-- One-time backfill of known historical events from existing columns. actor_name
-- snapshots profiles.full_name (fallback username, then '(unknown)').
insert into public.invoice_activity_log (invoice_id, actor_id, actor_name, action, entity_label, created_at)
select i.id, i.created_by, coalesce(p.full_name, p.username, '(unknown)'),
       'invoice.created', i.invoice_number, i.created_at
from public.invoices i
left join public.profiles p on p.id = i.created_by;

insert into public.invoice_activity_log (invoice_id, actor_id, actor_name, action, entity_label, metadata, created_at)
select pay.invoice_id, pay.created_by, coalesce(p.full_name, p.username, '(unknown)'),
       'payment.recorded', i.invoice_number,
       jsonb_build_object('amount', pay.amount, 'payment_date', pay.payment_date, 'reference_number', pay.reference_number),
       pay.created_at
from public.payments pay
join public.invoices i on i.id = pay.invoice_id
left join public.profiles p on p.id = pay.created_by;

insert into public.invoice_activity_log (invoice_id, actor_id, actor_name, action, entity_label, reason, created_at)
select i.id, i.voided_by, coalesce(p.full_name, p.username, '(unknown)'),
       'invoice.voided', i.invoice_number, i.void_reason, i.voided_at
from public.invoices i
left join public.profiles p on p.id = i.voided_by
where i.voided_at is not null and i.voided_by is not null;

insert into public.invoice_activity_log (invoice_id, actor_id, actor_name, action, entity_label, reason, created_at)
select i.id, i.deleted_by, coalesce(p.full_name, p.username, '(unknown)'),
       'invoice.soft_deleted', i.invoice_number, i.delete_reason, i.deleted_at
from public.invoices i
left join public.profiles p on p.id = i.deleted_by
where i.deleted_at is not null and i.deleted_by is not null;
