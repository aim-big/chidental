--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: work_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.work_status AS ENUM (
    'received',
    'in_progress',
    'ready',
    'delivered',
    'on_hold'
);


--
-- Name: create_invoice_with_items(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_invoice_with_items(p_invoice jsonb, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into invoices (
    customer_id, created_by, invoice_date, due_date, status, notes,
    patient, doctor, service_status_id,
    bill_to_name, bill_to_contact, bill_to_phone, billing_address,
    ship_to_name, ship_to_contact, delivery_address,
    subtotal, total
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
    coalesce((p_invoice->>'total')::numeric, 0)
  ) returning id into v_id;

  insert into invoice_items (invoice_id, product_id, description, quantity, unit_price, amount)
  select v_id,
         nullif(it->>'product_id', '')::uuid,
         it->>'description',
         (it->>'quantity')::numeric,
         (it->>'unit_price')::numeric,
         (it->>'amount')::numeric
  from jsonb_array_elements(p_items) as it;

  return v_id;
end;
$$;


--
-- Name: enforce_invoice_item_price_range(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_invoice_item_price_range() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  p_min numeric(12,2);
  p_max numeric(12,2);
begin
  if new.product_id is null then
    return new;
  end if;
  select min_unit_price, max_unit_price into p_min, p_max
    from products where id = new.product_id;
  if p_min is not null and p_max is not null
     and (new.unit_price < p_min or new.unit_price > p_max) then
    raise exception 'Unit price % is outside allowed range [%, %] for product %',
      new.unit_price, p_min, p_max, new.product_id;
  end if;
  return new;
end;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
DECLARE
  yr text := to_char(CURRENT_DATE, 'YYYY');
  prefix text := 'INV-' || yr || '-';
  next_num int;
BEGIN
  -- Serialize callers within a transaction to prevent races
  PERFORM pg_advisory_xact_lock(hashtext('generate_invoice_number'));

  SELECT COALESCE(
    MAX((regexp_replace(invoice_number, '^' || prefix, ''))::int),
    0
  ) + 1
  INTO next_num
  FROM invoices
  WHERE invoice_number ~ ('^' || prefix || '[0-9]+$');

  RETURN prefix || lpad(next_num::text, 4, '0');
END;
$_$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;


--
-- Name: log_invoice_item_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_invoice_item_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_username text;
BEGIN
  IF (TG_OP = 'INSERT')
     OR (NEW.work_status IS DISTINCT FROM OLD.work_status)
     OR (NEW.stage_id IS DISTINCT FROM OLD.stage_id) THEN
    v_username := nullif(coalesce(
      auth.jwt() -> 'user_metadata' ->> 'username',
      auth.jwt() ->> 'email'
    ), '');
    INSERT INTO invoice_item_status_history (invoice_item_id, status, stage_id, changed_by, changed_by_name)
    VALUES (NEW.id, NEW.work_status, NEW.stage_id, auth.uid(), v_username);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: set_invoice_number_default(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_invoice_number_default() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: stamp_invoice_item_work_status_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.stamp_invoice_item_work_status_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR (NEW.work_status IS DISTINCT FROM OLD.work_status)
     OR (NEW.stage_id IS DISTINCT FROM OLD.stage_id) THEN
    NEW.work_status_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_invoice_with_items(uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_invoice_with_items(p_invoice_id uuid, p_invoice jsonb, p_items jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
    amount      = (it->>'amount')::numeric
  from jsonb_array_elements(p_items) as it
  where coalesce(it->>'id', '') <> '' and ii.id = (it->>'id')::uuid;

  -- Insert the new rows (no id yet).
  insert into invoice_items (invoice_id, product_id, description, quantity, unit_price, amount)
  select p_invoice_id,
         nullif(it->>'product_id', '')::uuid,
         it->>'description',
         (it->>'quantity')::numeric,
         (it->>'unit_price')::numeric,
         (it->>'amount')::numeric
  from jsonb_array_elements(p_items) as it
  where coalesce(it->>'id', '') = '';
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    billing_address text,
    delivery_address text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ssm_no text
);


--
-- Name: invoice_item_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_item_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_item_id uuid NOT NULL,
    status public.work_status NOT NULL,
    note text,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by_name text,
    stage_id uuid
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid,
    description text NOT NULL,
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    work_status public.work_status DEFAULT 'received'::public.work_status NOT NULL,
    work_status_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    work_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    stage_id uuid
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    customer_id uuid NOT NULL,
    created_by uuid NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    patient text,
    doctor text,
    service_status_id uuid,
    billing_address text,
    delivery_address text,
    bill_to_name text,
    bill_to_contact text,
    bill_to_phone text,
    ship_to_name text,
    ship_to_contact text,
    voided_at timestamp with time zone,
    voided_by uuid,
    void_reason text,
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'partial'::text, 'paid'::text, 'overdue'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    reference_number text,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'unit'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    min_unit_price numeric(12,2),
    max_unit_price numeric(12,2),
    CONSTRAINT products_price_range_both_or_none CHECK ((((min_unit_price IS NULL) AND (max_unit_price IS NULL)) OR ((min_unit_price IS NOT NULL) AND (max_unit_price IS NOT NULL) AND (min_unit_price >= (0)::numeric) AND (max_unit_price >= min_unit_price))))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role_id uuid
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission text NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    color text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: work_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    color text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: invoice_item_status_history invoice_item_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item_status_history
    ADD CONSTRAINT invoice_item_status_history_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: service_statuses service_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_statuses
    ADD CONSTRAINT service_statuses_pkey PRIMARY KEY (id);


--
-- Name: work_stages work_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_stages
    ADD CONSTRAINT work_stages_pkey PRIMARY KEY (id);


--
-- Name: idx_invoice_items_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);


--
-- Name: idx_invoice_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_items_product_id ON public.invoice_items USING btree (product_id);


--
-- Name: idx_invoices_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_created_by ON public.invoices USING btree (created_by);


--
-- Name: idx_invoices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_customer_id ON public.invoices USING btree (customer_id);


--
-- Name: idx_invoices_invoice_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_payments_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_created_by ON public.payments USING btree (created_by);


--
-- Name: idx_payments_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_active ON public.products USING btree (active);


--
-- Name: invoice_item_status_history_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_item_status_history_item_idx ON public.invoice_item_status_history USING btree (invoice_item_id, changed_at DESC);


--
-- Name: invoice_items_work_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_work_status_idx ON public.invoice_items USING btree (work_status);


--
-- Name: invoices_service_status_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_service_status_id_idx ON public.invoices USING btree (service_status_id);


--
-- Name: service_statuses_label_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_statuses_label_unique ON public.service_statuses USING btree (lower(label)) WHERE is_active;


--
-- Name: invoice_items invoice_items_stamp_status_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_items_stamp_status_ts BEFORE INSERT OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.stamp_invoice_item_work_status_updated_at();


--
-- Name: invoice_items invoice_items_status_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_items_status_log AFTER INSERT OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.log_invoice_item_status_change();


--
-- Name: invoices invoices_set_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoices_set_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number_default();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: invoice_items trg_invoice_item_price_range; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invoice_item_price_range BEFORE INSERT OR UPDATE OF unit_price, product_id ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_item_price_range();


--
-- Name: invoice_item_status_history invoice_item_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item_status_history
    ADD CONSTRAINT invoice_item_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: invoice_item_status_history invoice_item_status_history_invoice_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item_status_history
    ADD CONSTRAINT invoice_item_status_history_invoice_item_id_fkey FOREIGN KEY (invoice_item_id) REFERENCES public.invoice_items(id) ON DELETE CASCADE;


--
-- Name: invoice_item_status_history invoice_item_status_history_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item_status_history
    ADD CONSTRAINT invoice_item_status_history_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.work_stages(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.work_stages(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_service_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_service_status_id_fkey FOREIGN KEY (service_status_id) REFERENCES public.service_statuses(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_voided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES auth.users(id);


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions authenticated read role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: roles authenticated read roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read roles" ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: customers authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.customers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: invoice_item_status_history authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.invoice_item_status_history TO authenticated USING (true) WITH CHECK (true);


--
-- Name: invoice_items authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.invoice_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: invoices authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.invoices TO authenticated USING (true) WITH CHECK (true);


--
-- Name: payments authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.payments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: products authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.products TO authenticated USING (true) WITH CHECK (true);


--
-- Name: service_statuses authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.service_statuses TO authenticated USING (true) WITH CHECK (true);


--
-- Name: work_stages authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.work_stages TO authenticated USING (true) WITH CHECK (true);


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_item_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_item_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_delete_admin ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: profiles profiles_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_admin ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: profiles profiles_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles profiles_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: service_statuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: work_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION create_invoice_with_items(p_invoice jsonb, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_invoice_with_items(p_invoice jsonb, p_items jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_invoice_with_items(p_invoice jsonb, p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_invoice_with_items(p_invoice jsonb, p_items jsonb) TO service_role;


--
-- Name: FUNCTION enforce_invoice_item_price_range(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_invoice_item_price_range() TO anon;
GRANT ALL ON FUNCTION public.enforce_invoice_item_price_range() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_invoice_item_price_range() TO service_role;


--
-- Name: FUNCTION generate_invoice_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_invoice_number() TO anon;
GRANT ALL ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_invoice_number() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION log_invoice_item_status_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.log_invoice_item_status_change() TO anon;
GRANT ALL ON FUNCTION public.log_invoice_item_status_change() TO authenticated;
GRANT ALL ON FUNCTION public.log_invoice_item_status_change() TO service_role;


--
-- Name: FUNCTION set_invoice_number_default(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_invoice_number_default() TO anon;
GRANT ALL ON FUNCTION public.set_invoice_number_default() TO authenticated;
GRANT ALL ON FUNCTION public.set_invoice_number_default() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION stamp_invoice_item_work_status_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.stamp_invoice_item_work_status_updated_at() TO anon;
GRANT ALL ON FUNCTION public.stamp_invoice_item_work_status_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.stamp_invoice_item_work_status_updated_at() TO service_role;


--
-- Name: FUNCTION update_invoice_with_items(p_invoice_id uuid, p_invoice jsonb, p_items jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_invoice_with_items(p_invoice_id uuid, p_invoice jsonb, p_items jsonb) TO anon;
GRANT ALL ON FUNCTION public.update_invoice_with_items(p_invoice_id uuid, p_invoice jsonb, p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_invoice_with_items(p_invoice_id uuid, p_invoice jsonb, p_items jsonb) TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE invoice_item_status_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoice_item_status_history TO anon;
GRANT ALL ON TABLE public.invoice_item_status_history TO authenticated;
GRANT ALL ON TABLE public.invoice_item_status_history TO service_role;


--
-- Name: TABLE invoice_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoice_items TO anon;
GRANT ALL ON TABLE public.invoice_items TO authenticated;
GRANT ALL ON TABLE public.invoice_items TO service_role;


--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoices TO anon;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE service_statuses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.service_statuses TO anon;
GRANT ALL ON TABLE public.service_statuses TO authenticated;
GRANT ALL ON TABLE public.service_statuses TO service_role;


--
-- Name: TABLE work_stages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.work_stages TO anon;
GRANT ALL ON TABLE public.work_stages TO authenticated;
GRANT ALL ON TABLE public.work_stages TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


