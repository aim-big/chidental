-- Deterministic local/staging seed. NEVER run against production.
-- Applied by `supabase db reset` (config.toml [db.seed]). Re-runnable: it targets
-- fixed dev ids with ON CONFLICT DO NOTHING so a re-reset is safe.
--
-- Login (staff auth is User ID + 6-digit PIN — see src/app/login/page.tsx):
--   User ID: seedowner    PIN: 123456
-- Internally the User ID maps to the synthetic email
-- `seedowner@chidentallab.local` (usernameToEmail, src/lib/auth/username.ts) and
-- the PIN is the Supabase Auth password. Keep the email + username in lockstep.
--
-- All ids are valid v4-form UUIDs (version nibble 4, variant 8) so seeded rows
-- flow cleanly through the strict z.string().uuid() schemas in src/domain/schemas.

-- 1. A confirmed login user. GoTrue needs encrypted_password + email_confirmed_at
--    + a matching auth.identities row to authenticate. The empty-string token
--    columns keep older GoTrue schemas (NOT NULL, no default) happy. pgcrypto
--    (crypt/gen_salt) lives in the `extensions` schema on Supabase.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'authenticated', 'authenticated', 'seedowner@chidentallab.local',
  extensions.crypt('123456', extensions.gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  now(), now(),
  '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","email":"seedowner@chidentallab.local"}',
  'email', now(), now(), now()
) on conflict (id) do nothing;

-- 2. Super-admin role (is_system => implicit all-permissions) + active profile.
insert into roles (id, name, is_system)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Owner (seed)', true)
on conflict (id) do nothing;

insert into profiles (id, username, role_id, active)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'seedowner',
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true)
on conflict (id) do nothing;

-- 3. A little navigable sample data (clinic + product + one sent invoice).
insert into customers (id, clinic_name, contact_person, phone, email, billing_address, delivery_address)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Seed Dental Clinic', 'Dr Seed', '0100000000',
        'clinic@seed.dev', '1 Seed St', '1 Seed St')
on conflict (id) do nothing;

insert into products (id, name, unit_price, unit)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Zirconia Crown', 250, 'tooth')
on conflict (id) do nothing;

insert into invoices (id, customer_id, created_by, due_date, subtotal, total, status)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', current_date + 30, 250, 250, 'sent')
on conflict (id) do nothing;
