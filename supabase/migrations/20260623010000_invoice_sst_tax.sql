-- Wave 5 — SST tax on invoices (additive; ships disabled at 0%).
--
-- Adds a per-invoice tax snapshot (rate + computed amount). Both default 0, so
-- every existing invoice is unchanged (total stays = subtotal - discount + 0).
-- The lab does NOT enable a non-zero rate until the accountant confirms the
-- Malaysian SST service-tax rate + threshold (master spec §16 Q2) — until then
-- the tax row simply renders as 0 / is hidden.
--
-- Money math (client-authoritative, mirrored on the printed doc):
--   discount_amount = round(subtotal * discount_pct/100, 2)
--   taxable_base    = subtotal - discount_amount
--   tax_amount      = round(taxable_base * tax_rate/100, 2)
--   total           = taxable_base + tax_amount
--
-- record_payment / void are NOT touched. Only the invoice-save RPCs are
-- re-created to thread tax_rate / tax_amount from p_invoice (building on the
-- Wave 4 discount columns already present).

alter table public.invoices
  add column tax_rate   numeric(5,2)  not null default 0,
  add column tax_amount numeric(12,2) not null default 0;

alter table public.invoices
  add constraint invoices_tax_rate_range check (tax_rate >= 0 and tax_rate <= 100);

create or replace function public.create_invoice_with_items(p_invoice jsonb, p_items jsonb)
 returns uuid
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  insert into invoices (
    customer_id, created_by, invoice_date, due_date, status, notes,
    patient, doctor, service_status_id,
    bill_to_name, bill_to_contact, bill_to_phone, billing_address,
    ship_to_name, ship_to_contact, delivery_address,
    subtotal, discount_pct, discount_amount, tax_rate, tax_amount, total
  ) values (
    (p_invoice->>'customer_id')::uuid,
    (p_invoice->>'created_by')::uuid,
    (p_invoice->>'invoice_date')::date,
    (p_invoice->>'due_date')::date,
    coalesce(p_invoice->>'status', 'draft'),
    p_invoice->>'notes',
    p_invoice->>'patient',
    p_invoice->>'doctor',
    nullif(p_invoice->>'service_status_id', '')::uuid,
    p_invoice->>'bill_to_name',
    p_invoice->>'bill_to_contact',
    p_invoice->>'bill_to_phone',
    p_invoice->>'billing_address',
    p_invoice->>'ship_to_name',
    p_invoice->>'ship_to_contact',
    p_invoice->>'delivery_address',
    coalesce((p_invoice->>'subtotal')::numeric, 0),
    coalesce((p_invoice->>'discount_pct')::numeric, 0),
    coalesce((p_invoice->>'discount_amount')::numeric, 0),
    coalesce((p_invoice->>'tax_rate')::numeric, 0),
    coalesce((p_invoice->>'tax_amount')::numeric, 0),
    coalesce((p_invoice->>'total')::numeric, 0)
  ) returning id into v_id;

  insert into invoice_items (invoice_id, product_id, description, quantity, unit_price, amount, work_note)
  select v_id,
         nullif(it->>'product_id', '')::uuid,
         it->>'description',
         (it->>'quantity')::numeric,
         (it->>'unit_price')::numeric,
         (it->>'amount')::numeric,
         nullif(it->>'work_note', '')
  from jsonb_array_elements(p_items) as it;

  return v_id;
end;
$function$;

create or replace function public.update_invoice_with_items(p_invoice_id uuid, p_invoice jsonb, p_items jsonb)
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
begin
  update invoices set
    customer_id       = (p_invoice->>'customer_id')::uuid,
    invoice_date      = (p_invoice->>'invoice_date')::date,
    due_date          = (p_invoice->>'due_date')::date,
    notes             = p_invoice->>'notes',
    patient           = p_invoice->>'patient',
    doctor            = p_invoice->>'doctor',
    service_status_id = nullif(p_invoice->>'service_status_id', '')::uuid,
    bill_to_name      = p_invoice->>'bill_to_name',
    bill_to_contact   = p_invoice->>'bill_to_contact',
    bill_to_phone     = p_invoice->>'bill_to_phone',
    billing_address   = p_invoice->>'billing_address',
    ship_to_name      = p_invoice->>'ship_to_name',
    ship_to_contact   = p_invoice->>'ship_to_contact',
    delivery_address  = p_invoice->>'delivery_address',
    subtotal          = coalesce((p_invoice->>'subtotal')::numeric, 0),
    discount_pct      = coalesce((p_invoice->>'discount_pct')::numeric, 0),
    discount_amount   = coalesce((p_invoice->>'discount_amount')::numeric, 0),
    tax_rate          = coalesce((p_invoice->>'tax_rate')::numeric, 0),
    tax_amount        = coalesce((p_invoice->>'tax_amount')::numeric, 0),
    total             = coalesce((p_invoice->>'total')::numeric, 0)
  where id = p_invoice_id;

  delete from invoice_items
  where invoice_id = p_invoice_id
    and id not in (
      select (it->>'id')::uuid
      from jsonb_array_elements(p_items) as it
      where coalesce(it->>'id', '') <> ''
    );

  update invoice_items ii set
    product_id  = nullif(it->>'product_id', '')::uuid,
    description = it->>'description',
    quantity    = (it->>'quantity')::numeric,
    unit_price  = (it->>'unit_price')::numeric,
    amount      = (it->>'amount')::numeric,
    work_note   = nullif(it->>'work_note', '')
  from jsonb_array_elements(p_items) as it
  where coalesce(it->>'id', '') <> '' and ii.id = (it->>'id')::uuid;

  insert into invoice_items (invoice_id, product_id, description, quantity, unit_price, amount, work_note)
  select p_invoice_id,
         nullif(it->>'product_id', '')::uuid,
         it->>'description',
         (it->>'quantity')::numeric,
         (it->>'unit_price')::numeric,
         (it->>'amount')::numeric,
         nullif(it->>'work_note', '')
  from jsonb_array_elements(p_items) as it
  where coalesce(it->>'id', '') = '';
end;
$function$;
