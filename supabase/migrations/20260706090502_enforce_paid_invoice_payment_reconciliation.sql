-- Stronger paid-invoice reconciliation guard.
--
-- The original guard only blocked writes that transitioned an invoice into
-- `paid` while recorded payments were below the invoice total. Now that old
-- data has been corrected, keep paid invoices reconciled exactly:
--
--   sum(payments.amount) == invoices.total
--
-- This blocks underpayment, overpayment, later payment edits/deletes, and paid
-- invoice total edits that would make reports disagree.

create or replace function public.assert_paid_invoice_reconciles(p_invoice_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_invoice_number text;
  v_status text;
  v_total numeric;
  v_paid numeric;
begin
  select invoice_number, status, total
    into v_invoice_number, v_status, v_total
  from public.invoices
  where id = p_invoice_id;

  if not found or v_status <> 'paid' then
    return;
  end if;

  select coalesce(sum(amount), 0)
    into v_paid
  from public.payments
  where invoice_id = p_invoice_id;

  if v_paid <> v_total then
    raise exception
      'Paid invoice % must have recorded payments exactly equal to the total: recorded RM%, total RM%.',
      coalesce(v_invoice_number, p_invoice_id::text),
      to_char(v_paid, 'FM999999990.00'),
      to_char(v_total, 'FM999999990.00')
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.enforce_paid_requires_payment()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_paid numeric;
begin
  if new.status = 'paid' then
    select coalesce(sum(amount), 0) into v_paid
    from public.payments
    where invoice_id = new.id;

    if v_paid <> new.total then
      raise exception
        'Paid invoice % must have recorded payments exactly equal to the total: recorded RM%, total RM%.',
        coalesce(new.invoice_number, new.id::text),
        to_char(v_paid, 'FM999999990.00'),
        to_char(new.total, 'FM999999990.00')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_paid_payment_change_reconciles()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.assert_paid_invoice_reconciles(new.invoice_id);
  end if;

  if tg_op = 'DELETE' then
    perform public.assert_paid_invoice_reconciles(old.invoice_id);
  elsif tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.assert_paid_invoice_reconciles(old.invoice_id);
  end if;

  return null;
end;
$$;

drop trigger if exists payments_enforce_paid_invoice_reconciles on public.payments;
create trigger payments_enforce_paid_invoice_reconciles
  after insert or update or delete on public.payments
  for each row execute function public.enforce_paid_payment_change_reconciles();
