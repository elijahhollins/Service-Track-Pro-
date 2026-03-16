-- =============================================================================
-- Service Track Pro — Super Admin Setup
-- =============================================================================
-- Run this AFTER multi_tenancy_setup.sql and invitations_setup.sql.
-- SAFE TO RE-RUN: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
--
-- This script establishes the super_admin role which is platform-wide
-- (not scoped to any company).  Only the super admin can create companies
-- and generate the initial admin invitation for each new company.
-- =============================================================================


-- ────────────────────────────────────────────────────────────────
-- STEP 0 — EXTEND users_role_check TO ALLOW 'super_admin'
-- ────────────────────────────────────────────────────────────────
-- The original check constraint on public.users only permits 'admin'
-- and 'foreman'.  Drop and recreate it to also permit 'super_admin'
-- so that create_super_admin.sql can insert the platform owner row.

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'foreman', 'super_admin'));


-- ────────────────────────────────────────────────────────────────
-- STEP 1 — is_super_admin() HELPER
-- ────────────────────────────────────────────────────────────────
-- Returns true when the calling authenticated user has role = 'super_admin'.
-- SECURITY DEFINER so it can query public.users without triggering
-- RLS recursion.

CREATE OR REPLACE FUNCTION public.is_super_admin()
  RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.users u
    JOIN   auth.users   a ON lower(trim(a.email)) = lower(trim(u.email))
    WHERE  a.id   = auth.uid()
      AND  u.role = 'super_admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- STEP 2 — create_company_as_super_admin() RPC
-- ────────────────────────────────────────────────────────────────
-- Creates a new company and a pending admin invitation in one atomic
-- transaction.  Only callable by users with role = 'super_admin'.
-- Returns the new company_id and the invite_token so the front-end
-- can build the invite URL.

CREATE OR REPLACE FUNCTION public.create_company_as_super_admin(
  p_company_name text,
  p_admin_email  text
)
  RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_email text;
  v_role       text;
  v_company_id uuid;
  v_token      uuid;
  v_invite_id  uuid;
BEGIN
  -- Verify the caller is authenticated
  SELECT email INTO v_auth_email
  FROM   auth.users
  WHERE  id = auth.uid();

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the caller is a super_admin
  SELECT role INTO v_role
  FROM   public.users
  WHERE  email = v_auth_email;

  IF v_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can create companies';
  END IF;

  -- Create the company
  INSERT INTO public.companies (name)
  VALUES (trim(p_company_name))
  RETURNING id INTO v_company_id;

  -- Create the admin invitation
  v_token := gen_random_uuid();
  INSERT INTO public.invitations (email, company_id, role, invite_token)
  VALUES (lower(trim(p_admin_email)), v_company_id, 'admin', v_token)
  RETURNING id INTO v_invite_id;

  RETURN json_build_object(
    'company_id',   v_company_id::text,
    'invite_token', v_token::text,
    'invite_id',    v_invite_id::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_as_super_admin TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- STEP 3 — RLS POLICIES FOR SUPER ADMIN
-- ────────────────────────────────────────────────────────────────

-- Super admin can SELECT all companies
DROP POLICY IF EXISTS "super_admin_companies_select" ON public.companies;
CREATE POLICY        "super_admin_companies_select"  ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Super admin can SELECT all invitations (cross-company visibility)
DROP POLICY IF EXISTS "super_admin_invitations_select" ON public.invitations;
CREATE POLICY        "super_admin_invitations_select"  ON public.invitations
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Super admin can INSERT invitations for any company
-- (needed when generating admin invite links for existing companies)
DROP POLICY IF EXISTS "super_admin_insert_invitations" ON public.invitations;
CREATE POLICY        "super_admin_insert_invitations"  ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Super admin can DELETE invitations (for revocation)
DROP POLICY IF EXISTS "super_admin_delete_invitations" ON public.invitations;
CREATE POLICY        "super_admin_delete_invitations"  ON public.invitations
  FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- ────────────────────────────────────────────────────────────────
-- STEP 4 — LOCK DOWN SELF-SERVICE COMPANY CREATION
-- ────────────────────────────────────────────────────────────────
-- Replace the permissive "allow_company_insert" policy so that only
-- SECURITY DEFINER RPCs (which bypass RLS) can create companies.
-- Regular authenticated users should never be able to INSERT companies
-- directly; they must go through an invite flow.

DROP POLICY IF EXISTS "allow_company_insert" ON public.companies;
CREATE POLICY        "allow_company_insert"  ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());


-- =============================================================================
-- DONE!
--
-- Next steps:
--   1. Run supabase/create_super_admin.sql to bootstrap the super admin account.
--   2. The super admin signs in and uses the Super Admin Console to:
--        a. Create companies
--        b. Generate admin invite links for each company
--   3. Company admins click their invite link, set up their account, then use
--      Settings → Invite Team Members to onboard foremen (with the option to
--      promote to admin afterwards via User Management).
-- =============================================================================
