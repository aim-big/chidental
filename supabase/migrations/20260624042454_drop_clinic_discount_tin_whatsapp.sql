-- Drop clinic-level Default Discount (%), TIN, and WhatsApp opt-in.
--
-- These three `customers` columns were added in the Wave 4 clinic-metadata
-- migration but are no longer surfaced in the clinic form or used by any linked
-- logic — the per-invoice discount pre-fill and the printed-invoice TIN line
-- were both removed. payment_terms_days stays (it still drives invoice due
-- dates). The invoices.discount_pct / discount_amount snapshot columns and the
-- save RPCs are deliberately untouched: per-invoice discounts remain supported.
--
-- discount_pct's CHECK constraint (customers_discount_pct_range) is dropped
-- automatically with the column. Existing data in these columns is discarded.

alter table public.customers
  drop column if exists discount_pct,
  drop column if exists tin,
  drop column if exists whatsapp_optin;
