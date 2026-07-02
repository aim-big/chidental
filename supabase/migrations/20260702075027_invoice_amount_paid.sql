-- invoices.amount_paid — denormalized sum of the invoice's payment rows, so
-- outstanding / A/R aging math can net out partial payments without joining
-- payments everywhere. Maintained by a trigger on payments (covers every
-- write path: record_payment, mark_invoice_paid, any future admin tooling),
-- then backfilled for existing rows.

alter table public.invoices
  add column if not exists amount_paid numeric not null default 0;

-- security definer: the sync must succeed regardless of which role wrote the
-- payment row (RLS on invoices must not block the denormalized update).
create or replace function public.sync_invoice_amount_paid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update invoices
      set amount_paid = (select coalesce(sum(amount), 0) from payments where invoice_id = new.invoice_id)
      where id = new.invoice_id;
  end if;
  -- On delete, or when an update re-points the payment at another invoice,
  -- resync the old invoice too.
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id) then
    update invoices
      set amount_paid = (select coalesce(sum(amount), 0) from payments where invoice_id = old.invoice_id)
      where id = old.invoice_id;
  end if;
  return null;
end;
$$;

drop trigger if exists payments_sync_invoice_amount_paid on public.payments;
create trigger payments_sync_invoice_amount_paid
  after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_amount_paid();

-- Backfill from existing payments.
update public.invoices i
  set amount_paid = coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0);
