-- Wave 4 — Clinic metadata + per-invoice discount (all additive).
--
-- 1. Clinic-level fields used by billing: payment terms (auto due-date),
--    a single per-clinic discount %, TIN (e-invoice readiness), WhatsApp
--    consent (PDPA). Discount model = one per-clinic rate (master spec §11),
--    NOT per-item negotiated pricing — confirm with owner before go-live.
-- 2. Invoice carries a discount snapshot (pct + computed amount) so a saved
--    invoice can always reconstruct its Subtotal → Discount → Total breakdown
--    independently of the clinic's current rate. Defaults 0 so every existing
--    invoice is unchanged (total stays = subtotal - 0).
-- 3. The atomic save RPCs are extended to read the two new invoice columns from
--    p_invoice. The client stays authoritative for subtotal/total (unchanged
--    contract); record_payment / void / money RPCs are NOT touched.

alter table public.customers
  add column payment_terms_days integer not null default 30,
  add column discount_pct       numeric(5,2) not null default 0,
  add column tin                text,
  add column whatsapp_optin     boolean not null default false;

alter table public.customers
  add constraint customers_discount_pct_range  check (discount_pct >= 0 and discount_pct <= 100),
  add constraint customers_payment_terms_nonneg check (payment_terms_days >= 0);

alter table public.invoices
  add column discount_pct    numeric(5,2)  not null default 0,
  add column discount_amount numeric(12,2) not null default 0;

alter table public.invoices
  add constraint invoices_discount_pct_range check (discount_pct >= 0 and discount_pct <= 100);

-- Re-create the save RPCs with discount_pct / discount_amount threaded through.
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
    subtotal, discount_pct, discount_amount, total
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
    total             = coalesce((p_invoice->>'total')::numeric, 0)
  where id = p_invoice_id;

  -- Remove line items the client dropped (kept rows carry their existing id).
  delete from invoice_items
  where invoice_id = p_invoice_id
    and id not in (
      select (it->>'id')::uuid
      from jsonb_array_elements(p_items) as it
      where coalesce(it->>'id', '') <> ''
    );

  -- Update the rows that still have an id.
  update invoice_items ii set
    product_id  = nullif(it->>'product_id', '')::uuid,
    description = it->>'description',
    quantity    = (it->>'quantity')::numeric,
    unit_price  = (it->>'unit_price')::numeric,
    amount      = (it->>'amount')::numeric,
    work_note   = nullif(it->>'work_note', '')
  from jsonb_array_elements(p_items) as it
  where coalesce(it->>'id', '') <> '' and ii.id = (it->>'id')::uuid;

  -- Insert the new rows (no id yet).
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
