-- Guard: an invoice may only be set to status 'paid' when its recorded payment
-- rows cover the total. This closes the gap that let INV-2026-0016 exist
-- (status='paid', amount_paid=0, zero payments) — a status written outside the
-- Record-Payment flow (a direct DB edit / import), which the app then displays
-- as the contradictory "Paid / RM0 / Outstanding RM0".
--
-- Transition-only: it fires only when a write SETS status to 'paid' (an INSERT
-- with status='paid', or an UPDATE where the old status was not already 'paid').
-- Editing an already-paid invoice is never re-validated, so pre-existing rows
-- (including INV-2026-0016 itself) are untouched — the Data Health panel surfaces
-- those for manual correction.
--
-- The normal flows still pass: record_payment and mark_invoice_paid both insert
-- the covering payment row BEFORE flipping status, so sum(payments) >= total by
-- the time this trigger runs (same transaction).

create or replace function public.enforce_paid_requires_payment()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_paid numeric;
begin
  if new.status = 'paid'
     and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select coalesce(sum(amount), 0) into v_paid
    from payments
    where invoice_id = new.id;

    if v_paid < new.total then
      raise exception
        'Cannot mark invoice % as paid: recorded payments (RM%) are below the total (RM%). Record a payment first.',
        coalesce(new.invoice_number, new.id::text),
        to_char(v_paid, 'FM999999990.00'),
        to_char(new.total, 'FM999999990.00')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists invoices_enforce_paid_requires_payment on invoices;
create trigger invoices_enforce_paid_requires_payment
  before insert or update on invoices
  for each row execute function public.enforce_paid_requires_payment();
