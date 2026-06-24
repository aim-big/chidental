-- Drop clinic-level Payment Terms (days).
--
-- The last of the Wave 4 clinic-metadata fields to be retired: the clinic form,
-- schema, data layer, and the invoice due-date auto-fill that read it were all
-- removed, leaving this column unused. Its CHECK constraint
-- (customers_payment_terms_nonneg) is dropped automatically with the column.
-- The invoice-side discount snapshot and save RPCs remain untouched.

alter table public.customers
  drop column if exists payment_terms_days;
