-- Super Admin cascade-delete for clinics (customers).
--
-- The app deliberately blocks deleting a clinic that still has invoices
-- (invoices.customer_id is ON DELETE RESTRICT). This SECURITY DEFINER RPC lets the
-- Super Admin console permanently remove a clinic AND everything hanging off it, in
-- one atomic transaction:
--   credits (customer_id / invoice_id FKs are NO ACTION -> delete first)
--   invoices (invoice_items + payments cascade automatically)
--   the clinic row
-- Returns the counts it removed so the caller can record them in the audit log.
--
-- Locked down exactly like admin_restore_void: revoked from public/anon/authenticated
-- so only the service-role admin client (used by the code-gated console action) runs it.
create or replace function public.admin_purge_clinic(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits  int;
  v_invoices int;
begin
  delete from public.credits  where customer_id = p_id;
  get diagnostics v_credits = row_count;

  delete from public.invoices where customer_id = p_id;  -- invoice_items + payments cascade
  get diagnostics v_invoices = row_count;

  delete from public.customers where id = p_id;

  return json_build_object('credits', v_credits, 'invoices', v_invoices);
end;
$$;

revoke all on function public.admin_purge_clinic(uuid) from public, anon, authenticated;
