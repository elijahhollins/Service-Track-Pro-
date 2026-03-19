-- =============================================================================
-- Service Track Pro – Nuke & Rebuild Schema (preserve public.users)
-- =============================================================================
-- Run this in your Supabase SQL editor (https://app.supabase.com → SQL Editor).
--
-- PURPOSE: Drops every table and function EXCEPT public.users, then rebuilds
-- the entire schema from scratch with correct UUID types on every column.
-- Use this to escape UUID / binding-type errors caused by running old setup
-- scripts that created company_id as BIGINT instead of UUID.
--
-- WHAT IS PRESERVED:
--   • auth.users      (Supabase-managed; never touched)
--   • public.users    (profiles – rows are kept; company_id is temporarily
--                      unlinked, then re-linked via the FK after companies
--                      is recreated)
--
-- WHAT IS DESTROYED:
--   • companies, jobs, work_logs, employees, equipment, materials,
--     templates, invitations, invoices, invoice_settings  (all data lost)
--   • get_my_company_id(), is_super_admin() functions
--
-- After running this script your users will have company_id = NULL.
-- Re-create your company row and update users.company_id to match.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Drop helper functions (CASCADE removes dependent RLS policies)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_my_company_id() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;

-- ---------------------------------------------------------------------------
-- STEP 2: Drop FK on public.users.company_id so we can drop companies safely
-- ---------------------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_company_id_fkey;

-- Null out company_id on all user rows so no orphan references linger
UPDATE public.users SET company_id = NULL;

-- ---------------------------------------------------------------------------
-- STEP 3: Drop all non-user tables (reverse dependency order)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS invoice_settings CASCADE;
DROP TABLE IF EXISTS invoices         CASCADE;
DROP TABLE IF EXISTS work_logs        CASCADE;
DROP TABLE IF EXISTS templates        CASCADE;
DROP TABLE IF EXISTS materials        CASCADE;
DROP TABLE IF EXISTS equipment        CASCADE;
DROP TABLE IF EXISTS employees        CASCADE;
DROP TABLE IF EXISTS jobs             CASCADE;
DROP TABLE IF EXISTS invitations      CASCADE;
DROP TABLE IF EXISTS companies        CASCADE;

-- ---------------------------------------------------------------------------
-- STEP 4: Rebuild companies
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- STEP 5: Re-add FK on public.users → companies (now UUID ↔ UUID, correct)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD CONSTRAINT users_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Ensure the column itself is UUID (in case an old script made it BIGINT).
-- All values are NULL at this point (set above), so USING NULL::uuid is safe
-- and avoids any type-cast issues with BIGINT → UUID conversions.
ALTER TABLE public.users
  ALTER COLUMN company_id TYPE UUID USING NULL::uuid;

-- ---------------------------------------------------------------------------
-- STEP 6: Recreate helper functions (must exist before RLS policies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- STEP 7: RLS – companies
-- ---------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (id = get_my_company_id() OR is_super_admin());

DROP POLICY IF EXISTS "companies_insert" ON companies;
CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- STEP 8: RLS – public.users (re-apply; table is preserved, not recreated)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (
    company_id = get_my_company_id()
    OR id = auth.uid()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (
    company_id = get_my_company_id()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "users_delete" ON public.users;
CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- STEP 9: JOBS
-- ---------------------------------------------------------------------------
CREATE TABLE jobs (
  id            BIGSERIAL PRIMARY KEY,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  job_name      TEXT NOT NULL DEFAULT '',
  job_number    TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  start_date    DATE,
  end_date      DATE,
  notes         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  foreman_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select" ON jobs;
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "jobs_insert" ON jobs;
CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "jobs_update" ON jobs;
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "jobs_delete" ON jobs;
CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- STEP 10: WORK LOGS
-- ---------------------------------------------------------------------------
CREATE TABLE work_logs (
  id         BIGSERIAL PRIMARY KEY,
  job_id     BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_logs_select" ON work_logs;
CREATE POLICY "work_logs_select" ON work_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND j.company_id = get_my_company_id())
  );

DROP POLICY IF EXISTS "work_logs_insert" ON work_logs;
CREATE POLICY "work_logs_insert" ON work_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND j.company_id = get_my_company_id())
  );

DROP POLICY IF EXISTS "work_logs_update" ON work_logs;
CREATE POLICY "work_logs_update" ON work_logs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND j.company_id = get_my_company_id())
  );

DROP POLICY IF EXISTS "work_logs_delete" ON work_logs;
CREATE POLICY "work_logs_delete" ON work_logs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id AND j.company_id = get_my_company_id())
  );

-- ---------------------------------------------------------------------------
-- STEP 11: EMPLOYEES
-- ---------------------------------------------------------------------------
CREATE TABLE employees (
  id          BIGSERIAL PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT '',
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "employees_delete" ON employees;
CREATE POLICY "employees_delete" ON employees
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- STEP 12: EQUIPMENT
-- ---------------------------------------------------------------------------
CREATE TABLE equipment (
  id          BIGSERIAL PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_select" ON equipment;
CREATE POLICY "equipment_select" ON equipment
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "equipment_insert" ON equipment;
CREATE POLICY "equipment_insert" ON equipment
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "equipment_update" ON equipment;
CREATE POLICY "equipment_update" ON equipment
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "equipment_delete" ON equipment;
CREATE POLICY "equipment_delete" ON equipment
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- STEP 13: MATERIALS
-- ---------------------------------------------------------------------------
CREATE TABLE materials (
  id         BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materials_select" ON materials;
CREATE POLICY "materials_select" ON materials
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "materials_insert" ON materials;
CREATE POLICY "materials_insert" ON materials
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "materials_update" ON materials;
CREATE POLICY "materials_update" ON materials
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "materials_delete" ON materials;
CREATE POLICY "materials_delete" ON materials
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- STEP 14: TEMPLATES
-- ---------------------------------------------------------------------------
CREATE TABLE templates (
  id         BIGSERIAL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON templates;
CREATE POLICY "templates_select" ON templates
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "templates_insert" ON templates;
CREATE POLICY "templates_insert" ON templates
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "templates_update" ON templates;
CREATE POLICY "templates_update" ON templates
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "templates_delete" ON templates;
CREATE POLICY "templates_delete" ON templates
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- STEP 15: INVITATIONS
-- company_id is nullable here intentionally: super-admin invitations are not
-- scoped to a company (company_id IS NULL), so there is no FK to violate.
-- Regular company invitations set company_id and cascade on company deletion.
-- ---------------------------------------------------------------------------
CREATE TABLE invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'foreman' CHECK (role IN ('admin','foreman')),
  token      TEXT NOT NULL UNIQUE,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_select" ON invitations;
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "invitations_insert" ON invitations;
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    OR is_super_admin()
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS "invitations_update" ON invitations;
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (true);

-- ---------------------------------------------------------------------------
-- STEP 16: INVOICES
-- ---------------------------------------------------------------------------
CREATE TABLE invoices (
  id              BIGSERIAL PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id          BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL DEFAULT '',
  date            TIMESTAMPTZ,
  due_date        TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
  labor_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  equipment_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- STEP 17: INVOICE SETTINGS
-- ---------------------------------------------------------------------------
CREATE TABLE invoice_settings (
  id              BIGSERIAL PRIMARY KEY,
  company_id      UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL DEFAULT 'Service Track Pro',
  company_address TEXT NOT NULL DEFAULT '123 Service Way, Industrial Park, Springfield, ST 55555',
  company_phone   TEXT NOT NULL DEFAULT '(555) 123-4567',
  company_email   TEXT NOT NULL DEFAULT 'billing@servicetrackpro.com',
  logo_initials   TEXT NOT NULL DEFAULT 'STP',
  payment_terms   TEXT NOT NULL DEFAULT 'Payment due within 30 days. Checks payable to the company above. Late payments subject to 1.5% monthly finance charge.',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_settings_select" ON invoice_settings;
CREATE POLICY "invoice_settings_select" ON invoice_settings
  FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "invoice_settings_insert" ON invoice_settings;
CREATE POLICY "invoice_settings_insert" ON invoice_settings
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

DROP POLICY IF EXISTS "invoice_settings_update" ON invoice_settings;
CREATE POLICY "invoice_settings_update" ON invoice_settings
  FOR UPDATE USING (company_id = get_my_company_id());

-- =============================================================================
-- DONE.
-- Next steps:
--   1. In the Supabase Table Editor (or SQL Editor), insert a row into companies:
--        INSERT INTO companies (name) VALUES ('Your Company Name')
--        RETURNING id;
--   2. Copy the returned UUID and run:
--        UPDATE public.users SET company_id = '<uuid>' WHERE email = 'your@email.com';
--   3. Log back into the app – all features should work with correct UUID types.
-- =============================================================================
