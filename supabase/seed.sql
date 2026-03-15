-- =============================================================================
-- Service Track Pro — Supabase Sample Data Seed
-- =============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- or via the Supabase CLI: supabase db reset --db-url <your-db-url>
--
-- OPTIONAL: Uncomment the lines below to wipe existing data first.
-- WARNING: This deletes ALL existing rows in these tables!
-- =============================================================================
-- TRUNCATE TABLE templates   RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE work_logs   RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE jobs        RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE materials   RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE equipment   RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE employees   RESTART IDENTITY CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DEMO AUTH USERS
--    Creates two Supabase Auth accounts and matching public.users profiles.
--    Passwords are hashed with bcrypt (password: "Demo1234!").
--    The `instance_id` is always '00000000-0000-0000-0000-000000000000' in
--    hosted Supabase.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  admin_uid   uuid := '11111111-1111-1111-1111-111111111111';
  foreman_uid uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  -- Admin user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_uid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role,
      email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid,
      'authenticated', 'authenticated',
      'admin@demo.com',
      crypt('Demo1234!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false
    );
  END IF;

  -- Foreman user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = foreman_uid) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role,
      email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      foreman_uid,
      'authenticated', 'authenticated',
      'foreman@demo.com',
      crypt('Demo1234!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false
    );
  END IF;
END $$;

-- Public user profiles (linked to auth users by email)
INSERT INTO public.users (name, email, password, role)
VALUES
  ('Alice Johnson',  'admin@demo.com',   'Demo1234!', 'admin'),
  ('Bob Martinez',   'foreman@demo.com', 'Demo1234!', 'foreman')
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. EMPLOYEES
-- -----------------------------------------------------------------------------
INSERT INTO public.employees (name, role, hourly_rate) VALUES
  ('David Thompson',   'Foreman',          75.00),
  ('Emma Rodriguez',   'Electrician',       65.00),
  ('Frank Chen',       'Plumber',           60.00),
  ('Grace Kim',        'HVAC Technician',   70.00),
  ('Henry Wilson',     'General Labor',     42.00),
  ('Isabella Martinez','Carpenter',         55.00)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. EQUIPMENT
-- -----------------------------------------------------------------------------
INSERT INTO public.equipment (name, hourly_rate) VALUES
  ('Excavator CAT 320',     150.00),
  ('Skid Steer Loader',      95.00),
  ('Concrete Mixer',         45.00),
  ('Scissor Lift 19 ft',     75.00),
  ('Generator 25 kW',        35.00),
  ('Air Compressor 60 gal',  25.00),
  ('Pressure Washer',        20.00)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. MATERIALS
-- -----------------------------------------------------------------------------
INSERT INTO public.materials (name, unit_price) VALUES
  ('Lumber 2×4×8',              8.50),
  ('Concrete Mix 50 lb bag',   12.00),
  ('PVC Pipe 4 in × 10 ft',    18.00),
  ('Electrical Wire 12/2 100 ft', 48.00),
  ('Drywall Sheet 4×8',        18.50),
  ('Roofing Shingles (bundle)', 35.00),
  ('Rebar #4 20 ft',           14.00),
  ('Interior Paint 1 gal',     32.00)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. JOBS
--    foreman_id references public.users; resolved by sub-select.
-- -----------------------------------------------------------------------------
INSERT INTO public.jobs (customer_name, job_name, job_number, address, start_date, end_date, notes, status, foreman_id)
VALUES
  (
    'Northside Properties LLC',
    'Downtown Office Complex Renovation',
    'JOB-2024-001',
    '123 Main Street, Suite 400, Downtown, CA 90210',
    '2024-01-15', '2024-06-30',
    'Full interior renovation including electrical, plumbing, and HVAC upgrades. Client requires minimal disruption to occupied floors.',
    'active',
    (SELECT id FROM public.users WHERE email = 'foreman@demo.com' LIMIT 1)
  ),
  (
    'Riverside Homes Inc.',
    'Riverside Residential Development',
    'JOB-2024-002',
    '45 Oak Avenue, Riverside, CA 92501',
    '2024-02-01', '2024-08-15',
    'New construction of 12-unit residential complex. Foundation complete. Currently framing second floor.',
    'active',
    (SELECT id FROM public.users WHERE email = 'foreman@demo.com' LIMIT 1)
  ),
  (
    'Greenfield School District',
    'Elementary School Roof Repair',
    'JOB-2024-003',
    '789 School Lane, Greenfield, CA 93927',
    '2024-03-10', '2024-04-05',
    'Emergency roof repair following storm damage. Replaced 3,200 sq ft of shingles and repaired two skylights. Project completed ahead of schedule.',
    'completed',
    (SELECT id FROM public.users WHERE email = 'foreman@demo.com' LIMIT 1)
  ),
  (
    'Harbor View Restaurant Group',
    'Restaurant Electrical Upgrade',
    'JOB-2024-004',
    '55 Harbor Drive, Marina Bay, CA 94925',
    '2024-04-20', '2024-05-31',
    'Upgrade main electrical panel to 400A service. Install dedicated circuits for new commercial kitchen equipment.',
    'active',
    (SELECT id FROM public.users WHERE email = 'foreman@demo.com' LIMIT 1)
  ),
  (
    'Westside Mall Management',
    'Shopping Center HVAC Installation',
    'JOB-2024-005',
    '1000 Westside Blvd, West City, CA 90025',
    '2024-01-08', '2024-03-22',
    'Install 8 commercial rooftop HVAC units across 45,000 sq ft retail space. All units commissioned and handed off.',
    'completed',
    (SELECT id FROM public.users WHERE email = 'foreman@demo.com' LIMIT 1)
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. WORK LOGS
--    employee/equipment IDs reference rows just inserted above (by position).
--    Using sub-selects keyed on name to stay resilient to serial ID values.
-- -----------------------------------------------------------------------------
INSERT INTO public.work_logs (job_id, date, notes, data)
VALUES
  -- JOB-2024-001 · Day 1
  (
    (SELECT id FROM public.jobs WHERE job_number = 'JOB-2024-001'),
    '2024-01-16',
    'Completed demolition of offices on floors 2–4. Removed old drywall and framing. Site secured for electrical rough-in tomorrow.',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'), 'hours', 8, 'rate', 75.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Henry Wilson'),   'hours', 8, 'rate', 42.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Isabella Martinez'), 'hours', 8, 'rate', 55.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Air Compressor 60 gal'), 'hours', 8, 'rate', 25.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('name', 'Disposal Bags', 'quantity', 30, 'unitPrice', 3.50)
      )
    )
  ),
  -- JOB-2024-001 · Day 2
  (
    (SELECT id FROM public.jobs WHERE job_number = 'JOB-2024-001'),
    '2024-01-17',
    'Electrical rough-in started on floors 2 and 3. New conduit runs laid for 200A sub-panel on floor 3.',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'), 'hours', 8, 'rate', 75.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Emma Rodriguez'), 'hours', 8, 'rate', 65.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Scissor Lift 19 ft'), 'hours', 6, 'rate', 75.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Electrical Wire 12/2 100 ft'), 'name', 'Electrical Wire 12/2 100 ft', 'quantity', 5, 'unitPrice', 48.00)
      )
    )
  ),
  -- JOB-2024-002 · Day 1
  (
    (SELECT id FROM public.jobs WHERE job_number = 'JOB-2024-002'),
    '2024-02-05',
    'Poured foundation footings for Building A. Concrete cured overnight. Rebar inspected and approved.',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'), 'hours', 10, 'rate', 75.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Henry Wilson'),   'hours', 10, 'rate', 42.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Frank Chen'),     'hours', 8,  'rate', 60.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Concrete Mixer'),  'hours', 8,  'rate', 45.00),
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Excavator CAT 320'), 'hours', 4, 'rate', 150.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Concrete Mix 50 lb bag'), 'name', 'Concrete Mix 50 lb bag', 'quantity', 80, 'unitPrice', 12.00),
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Rebar #4 20 ft'), 'name', 'Rebar #4 20 ft', 'quantity', 40, 'unitPrice', 14.00)
      )
    )
  ),
  -- JOB-2024-003 · Day 1 (completed job)
  (
    (SELECT id FROM public.jobs WHERE job_number = 'JOB-2024-003'),
    '2024-03-11',
    'Removed damaged shingles from west section (approx. 800 sq ft). Installed new underlayment and ice barrier.',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'),    'hours', 8, 'rate', 75.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Isabella Martinez'), 'hours', 8, 'rate', 55.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Henry Wilson'),      'hours', 8, 'rate', 42.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Air Compressor 60 gal'), 'hours', 8, 'rate', 25.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Roofing Shingles (bundle)'), 'name', 'Roofing Shingles (bundle)', 'quantity', 20, 'unitPrice', 35.00)
      )
    )
  ),
  -- JOB-2024-003 · Day 2 (completed job)
  (
    (SELECT id FROM public.jobs WHERE job_number = 'JOB-2024-003'),
    '2024-03-12',
    'Completed shingle replacement on all sections. Installed ridge cap and sealed skylights. Final inspection passed.',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'),    'hours', 8, 'rate', 75.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Isabella Martinez'), 'hours', 8, 'rate', 55.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Air Compressor 60 gal'), 'hours', 6, 'rate', 25.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Roofing Shingles (bundle)'), 'name', 'Roofing Shingles (bundle)', 'quantity', 15, 'unitPrice', 35.00),
        jsonb_build_object('name', 'Roofing Nails (box)', 'quantity', 4, 'unitPrice', 12.00),
        jsonb_build_object('name', 'Skylight Sealant', 'quantity', 2, 'unitPrice', 18.50)
      )
    )
  ),
  -- JOB-2024-004 · Day 1
  (
    (SELECT id FROM public.jobs WHERE job_number = 'JOB-2024-004'),
    '2024-04-22',
    'Shut off main power and removed old 200A panel. Installed new 400A service entrance and main breaker.',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Emma Rodriguez'), 'hours', 9, 'rate', 65.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'), 'hours', 9, 'rate', 75.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Generator 25 kW'), 'hours', 9, 'rate', 35.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Electrical Wire 12/2 100 ft'), 'name', 'Electrical Wire 12/2 100 ft', 'quantity', 3, 'unitPrice', 48.00),
        jsonb_build_object('name', '400A Main Breaker Panel', 'quantity', 1, 'unitPrice', 1250.00),
        jsonb_build_object('name', 'Service Entrance Cable 2/0', 'quantity', 2, 'unitPrice', 185.00)
      )
    )
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. TEMPLATES
-- -----------------------------------------------------------------------------
INSERT INTO public.templates (name, data)
VALUES
  (
    'Standard Electrical Day',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Emma Rodriguez'), 'hours', 8, 'rate', 65.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Scissor Lift 19 ft'), 'hours', 4, 'rate', 75.00),
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Generator 25 kW'),   'hours', 8, 'rate', 35.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Electrical Wire 12/2 100 ft'), 'name', 'Electrical Wire 12/2 100 ft', 'quantity', 2, 'unitPrice', 48.00)
      )
    )
  ),
  (
    'General Construction Day',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'),    'hours', 8, 'rate', 75.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Henry Wilson'),      'hours', 8, 'rate', 42.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Isabella Martinez'), 'hours', 8, 'rate', 55.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Air Compressor 60 gal'), 'hours', 8, 'rate', 25.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Lumber 2×4×8'), 'name', 'Lumber 2×4×8', 'quantity', 20, 'unitPrice', 8.50),
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Drywall Sheet 4×8'), 'name', 'Drywall Sheet 4×8', 'quantity', 10, 'unitPrice', 18.50)
      )
    )
  ),
  (
    'Roofing Crew Day',
    jsonb_build_object(
      'employees', jsonb_build_array(
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'David Thompson'),    'hours', 8, 'rate', 75.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Isabella Martinez'), 'hours', 8, 'rate', 55.00),
        jsonb_build_object('employeeId', (SELECT id FROM public.employees WHERE name = 'Henry Wilson'),      'hours', 8, 'rate', 42.00)
      ),
      'equipment', jsonb_build_array(
        jsonb_build_object('equipmentId', (SELECT id FROM public.equipment WHERE name = 'Air Compressor 60 gal'), 'hours', 8, 'rate', 25.00)
      ),
      'materials', jsonb_build_array(
        jsonb_build_object('materialId', (SELECT id FROM public.materials WHERE name = 'Roofing Shingles (bundle)'), 'name', 'Roofing Shingles (bundle)', 'quantity', 15, 'unitPrice', 35.00),
        jsonb_build_object('name', 'Roofing Nails (box)', 'quantity', 3, 'unitPrice', 12.00)
      )
    )
  )
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. DEMO COMPANY — link all seeded data to a single demo company
--    Run AFTER multi_tenancy_setup.sql has added the company_id columns.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  demo_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
  -- Create the demo company (idempotent)
  INSERT INTO public.companies (id, name)
  VALUES (demo_id, 'Demo Construction LLC')
  ON CONFLICT (id) DO NOTHING;

  -- Assign all existing rows (without a company) to the demo company
  UPDATE public.users      SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.employees  SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.equipment  SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.materials  SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.jobs       SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.work_logs  SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.templates  SET company_id = demo_id WHERE company_id IS NULL;
END $$;

-- =============================================================================
-- Done! Summary of seeded data:
--   Auth users  : 2  (admin@demo.com / foreman@demo.com — password: Demo1234!)
--   Users       : 2
--   Employees   : 6
--   Equipment   : 7
--   Materials   : 8
--   Jobs        : 5  (3 active, 2 completed)
--   Work logs   : 6
--   Templates   : 3
--   Company     : 1  (Demo Construction LLC — id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
-- =============================================================================
