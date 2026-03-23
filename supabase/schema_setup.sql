-- =============================================================================
-- Service Track Pro – Complete Database Schema
-- Run this in your Supabase SQL editor (https://app.supabase.com → SQL Editor).
-- This script is idempotent: safe to run on a fresh project or re-run if needed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. COMPANIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. USERS (public profile linked to auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin','admin','foreman')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS
-- (Defined before policies so all subsequent CREATE POLICY statements can
--  resolve the function names at creation time.)
-- ---------------------------------------------------------------------------

-- Returns the company_id (UUID) of the currently authenticated user.
-- DROP first so we can change the return type if an old BIGINT version exists.
DROP FUNCTION IF EXISTS get_my_company_id() CASCADE;
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Returns true if the current user is a super_admin.
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

-- Creates a company and links the calling admin user to it in one atomic
-- SECURITY DEFINER call, bypassing RLS on the companies table.
CREATE OR REPLACE FUNCTION create_company(company_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
      AND company_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied: only an admin user without an existing company can call create_company';
  END IF;

  INSERT INTO public.companies (name)
  VALUES (company_name)
  RETURNING id INTO v_company_id;

  UPDATE public.users
  SET company_id = v_company_id
  WHERE id = auth.uid();

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_company(TEXT) TO authenticated;

-- Atomically registers a new user: creates the company (if needed) and the
-- public.users profile in one SECURITY DEFINER call that bypasses RLS.
-- Callable by the anon role so it works before email confirmation.
-- Idempotent: safe to call more than once for the same user.
CREATE OR REPLACE FUNCTION register_with_company(
  p_user_id      UUID,
  p_name         TEXT,
  p_email        TEXT,
  p_company_name TEXT DEFAULT NULL,
  p_role         TEXT DEFAULT 'admin',
  p_company_id   UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Security: verify the supplied id+email pair exists in auth.users.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id AND email = p_email
  ) THEN
    RAISE EXCEPTION 'register_with_company: user id/email mismatch or user does not exist';
  END IF;

  -- Get or create the company.
  v_company_id := p_company_id;
  IF v_company_id IS NULL
     AND p_company_name IS NOT NULL
     AND trim(p_company_name) <> ''
  THEN
    INSERT INTO public.companies (name)
    VALUES (trim(p_company_name))
    RETURNING id INTO v_company_id;
  END IF;

  -- Insert profile; on retry, only fill in blank/missing fields.
  INSERT INTO public.users (id, name, email, role, company_id)
  VALUES (p_user_id, p_name, p_email, p_role, v_company_id)
  ON CONFLICT (id) DO UPDATE
    SET company_id = COALESCE(public.users.company_id, EXCLUDED.company_id),
        name       = CASE
                       WHEN public.users.name IS NULL OR public.users.name = ''
                       THEN EXCLUDED.name
                       ELSE public.users.name
                     END;

  RETURN json_build_object('company_id', v_company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION register_with_company(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION register_with_company(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS POLICIES – companies & users
-- ---------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (id = get_my_company_id());

DROP POLICY IF EXISTS "companies_insert" ON companies;
CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (true);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON users;
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    company_id = get_my_company_id()
    OR id = auth.uid()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "users_insert" ON users;
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_update" ON users;
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    company_id = get_my_company_id()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "users_delete" ON users;
CREATE POLICY "users_delete" ON users
  FOR DELETE USING (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- 5. JOBS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
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
  foreman_id    UUID REFERENCES users(id) ON DELETE SET NULL,
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
-- 6. WORK LOGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_logs (
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
-- 7. EMPLOYEES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id           BIGSERIAL PRIMARY KEY,
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT '',
  hourly_rate  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
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
-- 8. EQUIPMENT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
  id           BIGSERIAL PRIMARY KEY,
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  hourly_rate  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
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
-- 9. MATERIALS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
  id          BIGSERIAL PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  unit_price  NUMERIC(10,2) DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent: make unit_price nullable on existing databases that were
-- created before the "unlisted materials" feature was added.
ALTER TABLE materials ALTER COLUMN unit_price DROP NOT NULL;
ALTER TABLE materials ALTER COLUMN unit_price SET DEFAULT NULL;

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
-- 10. TEMPLATES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
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
-- 11. INVITATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
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

-- Anyone (including unauthenticated) can read a valid invitation by token
DROP POLICY IF EXISTS "invitations_select" ON invitations;
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (true);

-- Admins can create invitations for their own company
DROP POLICY IF EXISTS "invitations_insert" ON invitations;
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    OR is_super_admin()
    OR company_id IS NULL
  );

-- Allow marking invitation as used (any authenticated user claiming the token)
DROP POLICY IF EXISTS "invitations_update" ON invitations;
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (true);

-- ---------------------------------------------------------------------------
-- 12. INVOICES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id               BIGSERIAL PRIMARY KEY,
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id           BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  invoice_number   TEXT NOT NULL DEFAULT '',
  date             TIMESTAMPTZ,
  due_date         TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid')),
  labor_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  equipment_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  data             JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
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
-- 13. INVOICE SETTINGS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_settings (
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
