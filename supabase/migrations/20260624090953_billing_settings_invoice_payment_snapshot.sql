-- Billing settings + per-invoice payment-detail snapshots.
--
-- Current billing details belong in Settings, but issued invoice documents
-- must not drift when the lab changes bank accounts later. Draft invoices keep
-- snapshot columns NULL and render the current settings. Once sent, those
-- details are copied onto the invoice and stay there.

create table public.lab_billing_settings (
  id text primary key default 'default',
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  payment_note text not null,
  invoice_notes text[] not null default array[]::text[],
  updated_at timestamp with time zone not null default now(),
  updated_by uuid references public.profiles(id),
  constraint lab_billing_settings_singleton check (id = 'default'),
  constraint lab_billing_settings_bank_name_not_blank check (length(btrim(bank_name)) > 0),
  constraint lab_billing_settings_account_name_not_blank check (length(btrim(account_name)) > 0),
  constraint lab_billing_settings_account_number_not_blank check (length(btrim(account_number)) > 0)
);

insert into public.lab_billing_settings (
  id,
  bank_name,
  account_name,
  account_number,
  payment_note,
  invoice_notes
) values (
  'default',
  'Public Bank',
  'Chi Dental Lab Sdn Bhd',
  '3249402703',
  'Please use invoice number as payment reference',
  array['Goods sold are neither returnable nor refundable.']
) on conflict (id) do nothing;

alter table public.lab_billing_settings enable row level security;

create policy lab_billing_settings_read on public.lab_billing_settings
  for select to authenticated
  using (true);

create policy lab_billing_settings_insert on public.lab_billing_settings
  for insert to authenticated
  with check ((select public.auth_has_permission('settings.manage')));

create policy lab_billing_settings_update on public.lab_billing_settings
  for update to authenticated
  using ((select public.auth_has_permission('settings.manage')))
  with check ((select public.auth_has_permission('settings.manage')));

drop trigger if exists set_lab_billing_settings_updated_at on public.lab_billing_settings;
create trigger set_lab_billing_settings_updated_at
  before update on public.lab_billing_settings
  for each row execute function public.set_updated_at();

alter table public.invoices
  add column payment_bank_name text,
  add column payment_account_name text,
  add column payment_account_number text,
  add column payment_note text,
  add column invoice_notes text[];

-- Existing customer-facing / completed documents keep printing exactly as they
-- did before this migration. Existing drafts remain live against current
-- settings until they are sent.
update public.invoices
set
  payment_bank_name = 'Public Bank',
  payment_account_name = 'Chi Dental Lab Sdn Bhd',
  payment_account_number = '3249402703',
  payment_note = 'Please use invoice number as payment reference',
  invoice_notes = array['Goods sold are neither returnable nor refundable.']
where status <> 'draft' or voided_at is not null;

-- Recreate the latest save RPC with payment snapshot fields accepted from the
-- server action for invoices created directly as sent. Drafts pass NULLs.
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
    subtotal, total,
    payment_bank_name, payment_account_name, payment_account_number,
    payment_note, invoice_notes
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
    coalesce((p_invoice->>'total')::numeric, 0),
    nullif(p_invoice->>'payment_bank_name', ''),
    nullif(p_invoice->>'payment_account_name', ''),
    nullif(p_invoice->>'payment_account_number', ''),
    nullif(p_invoice->>'payment_note', ''),
    case
      when jsonb_typeof(p_invoice->'invoice_notes') = 'array' then
        array(select jsonb_array_elements_text(p_invoice->'invoice_notes'))
      else null
    end
  ) returning id into v_id;

  insert into invoice_items (invoice_id, product_id, description, quantity, unit_price, amount, work_note, sort_order)
  select v_id,
         nullif(it->>'product_id', '')::uuid,
         it->>'description',
         (it->>'quantity')::numeric,
         (it->>'unit_price')::numeric,
         (it->>'amount')::numeric,
         nullif(it->>'work_note', ''),
         (ord - 1)::int
  from jsonb_array_elements(p_items) with ordinality as t(it, ord);

  return v_id;
end;
$function$;
