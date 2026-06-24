-- Move the lab's standard payment terms (days) out of code and into billing
-- settings. This is the single "30" that derives every NEW invoice's due_date
-- (invoice_date + this); due_date is still stored per invoice, so historical
-- invoices keep their already-frozen due date when this value changes later.
-- Existing settings rows backfill to 30 via the column default.
alter table public.lab_billing_settings
  add column if not exists payment_terms_days integer not null default 30;

alter table public.lab_billing_settings
  add constraint lab_billing_settings_payment_terms_positive
  check (payment_terms_days >= 1);
