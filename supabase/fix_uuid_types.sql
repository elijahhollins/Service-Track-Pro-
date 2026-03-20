-- =============================================================================
-- Service Track Pro – Fix UUID / BIGINT type mismatch
-- Run this in your Supabase SQL editor if you already ran the old setup scripts
-- and are seeing errors like:
--   "operator does not exist: bigint = uuid"
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Drop RLS policies that reference the affected columns before altering types
-- (Postgres requires this to avoid dependency errors on the column type.)
-- ---------------------------------------------------------------------------

-- invoice_settings
DROP POLICY IF EXISTS "invoice_settings_select" ON invoice_settings;
DROP POLICY IF EXISTS "invoice_settings_insert" ON invoice_settings;
DROP POLICY IF EXISTS "invoice_settings_update" ON invoice_settings;

-- jobs (foreman_id was TEXT/string, but ensure it matches users.id UUID)
DROP POLICY IF EXISTS "jobs_select" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_update" ON jobs;
DROP POLICY IF EXISTS "jobs_delete" ON jobs;

-- employees
DROP POLICY IF EXISTS "employees_select" ON employees;
DROP POLICY IF EXISTS "employees_insert" ON employees;
DROP POLICY IF EXISTS "employees_update" ON employees;
DROP POLICY IF EXISTS "employees_delete" ON employees;

-- equipment
DROP POLICY IF EXISTS "equipment_select" ON equipment;
DROP POLICY IF EXISTS "equipment_insert" ON equipment;
DROP POLICY IF EXISTS "equipment_update" ON equipment;
DROP POLICY IF EXISTS "equipment_delete" ON equipment;

-- materials
DROP POLICY IF EXISTS "materials_select" ON materials;
DROP POLICY IF EXISTS "materials_insert" ON materials;
DROP POLICY IF EXISTS "materials_update" ON materials;
DROP POLICY IF EXISTS "materials_delete" ON materials;

-- templates
DROP POLICY IF EXISTS "templates_select" ON templates;
DROP POLICY IF EXISTS "templates_insert" ON templates;
DROP POLICY IF EXISTS "templates_update" ON templates;
DROP POLICY IF EXISTS "templates_delete" ON templates;

-- invoices
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;

-- users
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- ---------------------------------------------------------------------------
-- Alter company_id columns from BIGINT → UUID where needed
--
-- IMPORTANT: This cast works only when company_id values are already valid
-- UUID strings (e.g. '550e8400-e29b-41d4-a716-446655440000').  If you have
-- rows where company_id is a plain integer (e.g. 1, 2, 3) the cast will fail.
-- In that case you must first empty the affected tables or update the values to
-- real UUIDs that correspond to rows in the `companies` table.
--
-- Note: PostgreSQL cannot cast BIGINT → UUID directly.  The double cast
-- (::text::uuid) first converts the BIGINT to its text representation and then
-- parses that text as a UUID.  This is required by PostgreSQL's type system.
--
-- If the table is empty (the most common scenario when the error appears during
-- initial setup), the ALTER below is a no-op and will succeed.
-- ---------------------------------------------------------------------------

-- invoice_settings.company_id
ALTER TABLE invoice_settings
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- jobs.company_id
ALTER TABLE jobs
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- jobs.foreman_id (was TEXT/string, cast to UUID)
ALTER TABLE jobs
  ALTER COLUMN foreman_id TYPE UUID USING foreman_id::uuid;

-- employees.company_id
ALTER TABLE employees
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- equipment.company_id
ALTER TABLE equipment
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- materials.company_id
ALTER TABLE materials
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- templates.company_id
ALTER TABLE templates
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- invoices.company_id
ALTER TABLE invoices
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- users.company_id
ALTER TABLE users
  ALTER COLUMN company_id TYPE UUID USING company_id::text::uuid;

-- ---------------------------------------------------------------------------
-- Recreate get_my_company_id() to return UUID (idempotent)
-- DROP first so PostgreSQL allows changing the return type from BIGINT → UUID.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_my_company_id() CASCADE;
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
-- Recreate RLS policies with correct UUID comparisons
-- ---------------------------------------------------------------------------

-- users
CREATE POLICY "users_select" ON users
  FOR SELECT USING (
    company_id = get_my_company_id()
    OR id = auth.uid()
    OR is_super_admin()
  );
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (company_id = get_my_company_id() OR id = auth.uid());
CREATE POLICY "users_delete" ON users
  FOR DELETE USING (company_id = get_my_company_id());

-- jobs
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE USING (company_id = get_my_company_id());

-- employees
CREATE POLICY "employees_select" ON employees
  FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "employees_insert" ON employees
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "employees_update" ON employees
  FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "employees_delete" ON employees
  FOR DELETE USING (company_id = get_my_company_id());

-- equipment
CREATE POLICY "equipment_select" ON equipment
  FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "equipment_insert" ON equipment
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "equipment_update" ON equipment
  FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "equipment_delete" ON equipment
  FOR DELETE USING (company_id = get_my_company_id());

-- materials
CREATE POLICY "materials_select" ON materials
  FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "materials_insert" ON materials
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "materials_update" ON materials
  FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "materials_delete" ON materials
  FOR DELETE USING (company_id = get_my_company_id());

-- templates
CREATE POLICY "templates_select" ON templates
  FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "templates_insert" ON templates
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "templates_update" ON templates
  FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "templates_delete" ON templates
  FOR DELETE USING (company_id = get_my_company_id());

-- invoices
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (company_id = get_my_company_id());
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (company_id = get_my_company_id());

-- invoice_settings
CREATE POLICY "invoice_settings_select" ON invoice_settings
  FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "invoice_settings_insert" ON invoice_settings
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "invoice_settings_update" ON invoice_settings
  FOR UPDATE USING (company_id = get_my_company_id());
