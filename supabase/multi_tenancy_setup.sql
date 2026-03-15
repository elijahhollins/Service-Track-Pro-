-- =============================================================================
-- Service Track Pro — Multi-Tenancy Setup
-- =============================================================================
-- Modeled after the DigTrack Pro multi-tenant architecture using company_id.
--
-- HOW TO RUN
-- ----------
-- 1. Open your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar → "New query"
-- 3. Copy everything below and paste it in
-- 4. Click the green "Run" button (or press Ctrl+Enter)
-- 5. You should see "Success. No rows returned."
--
-- SAFE TO RE-RUN: every statement uses IF NOT EXISTS / OR REPLACE /
-- DROP IF EXISTS so running it more than once won't break anything.
-- =============================================================================


-- ────────────────────────────────────────────────────────────────
-- STEP 1 — COMPANIES TABLE
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companies (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────
-- STEP 2 — ADD company_id TO ALL TENANT TABLES
--
-- Each ALTER TABLE uses IF NOT EXISTS so it is safe to re-run.
-- The column is nullable so existing rows are not broken.
-- ────────────────────────────────────────────────────────────────

-- users — every user profile belongs to a company
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- jobs — every job belongs to a company
ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- employees — every employee record belongs to a company
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- equipment — every equipment record belongs to a company
ALTER TABLE public.equipment
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- materials — every material belongs to a company
ALTER TABLE public.materials
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- work_logs — every work log belongs to a company
ALTER TABLE public.work_logs
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- templates — every template belongs to a company
ALTER TABLE public.templates
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);


-- ────────────────────────────────────────────────────────────────
-- STEP 3 — ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.companies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates  ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────────
-- STEP 4 — SECURITY-DEFINER HELPER FUNCTIONS
--
-- These run with elevated privileges to avoid Postgres's infinite
-- recursion error that occurs when an RLS policy queries the same
-- table it is protecting.
-- ────────────────────────────────────────────────────────────────

-- Returns the company_id for the currently authenticated user.
-- SECURITY DEFINER so it can query public.users + auth.users
-- without triggering recursion on the users RLS policies.
CREATE OR REPLACE FUNCTION public.get_my_company_id()
  RETURNS uuid
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.company_id
  FROM   public.users u
  JOIN   auth.users   a ON a.email = u.email
  WHERE  a.id = auth.uid()
  LIMIT  1
$$;

-- Returns company details by name (case-insensitive).
-- Callable by anon so the sign-up page can look up a company
-- before the new user creates their Supabase Auth account.
CREATE OR REPLACE FUNCTION public.get_company_by_name(p_name text)
  RETURNS TABLE(company_id uuid, company_name text)
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id, name
  FROM   public.companies
  WHERE  lower(name) = lower(p_name)
  LIMIT  1
$$;

-- Handles full sign-up / company-join in one atomic transaction.
-- Called via supabase.rpc() from the front-end after Supabase Auth
-- creates the account.  SECURITY DEFINER bypasses RLS so it can
-- freely read/write users and companies during bootstrap.
--
-- Logic:
--   • If p_company_name matches an existing company  → join it as foreman
--   • If p_company_name is new                       → create it, join as admin
--   • If the public.users row already exists         → update company_id only
CREATE OR REPLACE FUNCTION public.register_with_company(
    p_user_name    text,
    p_company_name text
)
  RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_email   text;
  v_company_id   uuid;
  v_role         text;
  v_existing_uid int;
BEGIN
  -- Resolve the calling user's email from the Supabase Auth session
  SELECT email INTO v_auth_email
  FROM   auth.users
  WHERE  id = auth.uid();

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find or create the company
  SELECT id INTO v_company_id
  FROM   public.companies
  WHERE  lower(name) = lower(p_company_name);

  IF v_company_id IS NOT NULL THEN
    -- Company exists → join as foreman
    v_role := 'foreman';
  ELSE
    -- New company → create it, joining user becomes admin
    INSERT INTO public.companies (name)
    VALUES (p_company_name)
    RETURNING id INTO v_company_id;

    v_role := 'admin';
  END IF;

  -- Check if a public.users profile already exists for this email
  SELECT id INTO v_existing_uid
  FROM   public.users
  WHERE  email = v_auth_email;

  IF v_existing_uid IS NOT NULL THEN
    -- Profile exists (e.g. legacy row without company_id) — update it
    UPDATE public.users
    SET    company_id = v_company_id
    WHERE  id         = v_existing_uid
      AND  company_id IS NULL;
  ELSE
    -- First time — insert a new profile row
    INSERT INTO public.users (name, email, role, company_id)
    VALUES (
      COALESCE(NULLIF(trim(p_user_name), ''), split_part(v_auth_email, '@', 1)),
      v_auth_email,
      v_role,
      v_company_id
    );
  END IF;

  RETURN json_build_object(
    'company_id', v_company_id::text,
    'role',       v_role
  );
END;
$$;

-- Grant execution rights
GRANT EXECUTE ON FUNCTION public.get_my_company_id      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_by_name    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_with_company  TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- STEP 5 — ROW LEVEL SECURITY POLICIES
--
-- DROP before CREATE so re-running this script never errors.
-- ────────────────────────────────────────────────────────────────

-- ── companies ───────────────────────────────────────────────────

-- Any signed-in user may create a company (needed for bootstrap
-- before a profile row exists).
DROP POLICY IF EXISTS "allow_company_insert" ON public.companies;
CREATE POLICY        "allow_company_insert"  ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Regular users see only their own company.
DROP POLICY IF EXISTS "tenant_isolation_companies" ON public.companies;
CREATE POLICY        "tenant_isolation_companies"  ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.get_my_company_id());

-- ── users ────────────────────────────────────────────────────────

-- Every user can always read their OWN profile row (needed when
-- their profile is first created and company_id is being set).
DROP POLICY IF EXISTS "allow_own_profile_select" ON public.users;
CREATE POLICY        "allow_own_profile_select"  ON public.users
  FOR SELECT TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- All members of the same company see each other's profiles.
DROP POLICY IF EXISTS "tenant_isolation_users" ON public.users;
CREATE POLICY        "tenant_isolation_users"  ON public.users
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- Only allow admins / same-company members to update user records
-- (used for role promotion).
DROP POLICY IF EXISTS "tenant_update_users" ON public.users;
CREATE POLICY        "tenant_update_users"  ON public.users
  FOR UPDATE TO authenticated
  USING      (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ── jobs ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_jobs" ON public.jobs;
CREATE POLICY        "tenant_isolation_jobs"  ON public.jobs
  FOR ALL TO authenticated
  USING      (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ── employees ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_employees" ON public.employees;
CREATE POLICY        "tenant_isolation_employees"  ON public.employees
  FOR ALL TO authenticated
  USING      (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ── equipment ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_equipment" ON public.equipment;
CREATE POLICY        "tenant_isolation_equipment"  ON public.equipment
  FOR ALL TO authenticated
  USING      (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ── materials ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_materials" ON public.materials;
CREATE POLICY        "tenant_isolation_materials"  ON public.materials
  FOR ALL TO authenticated
  USING      (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ── work_logs ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_work_logs" ON public.work_logs;
CREATE POLICY        "tenant_isolation_work_logs"  ON public.work_logs
  FOR ALL TO authenticated
  USING      (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- ── templates ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_templates" ON public.templates;
CREATE POLICY        "tenant_isolation_templates"  ON public.templates
  FOR ALL TO authenticated
  USING      (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());


-- ────────────────────────────────────────────────────────────────
-- STEP 6 — GRANT TABLE ACCESS TO AUTHENTICATED USERS
-- ────────────────────────────────────────────────────────────────

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;


-- =============================================================================
-- DONE!
--
-- Next steps:
--   1. Run supabase/seed.sql to insert demo data scoped to a demo company.
--   2. Deploy your app — new sign-ups will be prompted for a company name.
--   3. Existing users without a company_id will see a one-time
--      "Register Company" modal the next time they log in.
-- =============================================================================
