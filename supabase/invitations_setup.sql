-- =============================================================================
-- Service Track Pro — Invitations Setup
-- =============================================================================
-- Magic-link invitation system for onboarding crew and foremen.
--
-- HOW TO RUN
-- ----------
-- Run this AFTER multi_tenancy_setup.sql in the Supabase SQL Editor.
-- SAFE TO RE-RUN: uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.
-- =============================================================================


-- ────────────────────────────────────────────────────────────────
-- STEP 1 — INVITATIONS TABLE
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invitations (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email        text        NOT NULL,
    company_id   uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role         text        NOT NULL DEFAULT 'foreman',
    invited_by   int         REFERENCES public.users(id) ON DELETE SET NULL,
    accepted_at  timestamp with time zone,
    created_at   timestamp with time zone DEFAULT now()
);

-- invite_token: a unique shareable UUID embedded in the invite URL.
-- Admins copy <app-url>/?invite=<invite_token> and send it to invitees.
ALTER TABLE public.invitations
    ADD COLUMN IF NOT EXISTS invite_token uuid UNIQUE DEFAULT gen_random_uuid();


-- ────────────────────────────────────────────────────────────────
-- STEP 2 — ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Company members can view invitations belonging to their company
DROP POLICY IF EXISTS "tenant_isolation_invitations"     ON public.invitations;
CREATE POLICY        "tenant_isolation_invitations"      ON public.invitations
    FOR SELECT TO authenticated
    USING (company_id = public.get_my_company_id());

-- Any authenticated user can read invitations addressed to their own email
-- (needed so accept_invitation can work before the profile row is created)
DROP POLICY IF EXISTS "own_email_invitation_select"      ON public.invitations;
CREATE POLICY        "own_email_invitation_select"       ON public.invitations
    FOR SELECT TO authenticated
    USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Company members (admins) can create invitations for their own company
DROP POLICY IF EXISTS "admin_insert_invitations"         ON public.invitations;
CREATE POLICY        "admin_insert_invitations"          ON public.invitations
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_my_company_id());


-- ────────────────────────────────────────────────────────────────
-- STEP 3 — accept_invitation FUNCTION
-- ────────────────────────────────────────────────────────────────
-- Called after a magic-link recipient enters their name.
-- Finds the pending invitation, creates/updates the user profile,
-- and marks the invitation as accepted.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_user_name text)
  RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_email  text;
  v_inv         record;
  v_existing_id int;
BEGIN
  -- Resolve the calling user's email from the Supabase Auth session
  SELECT email INTO v_auth_email
  FROM   auth.users
  WHERE  id = auth.uid();

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the most recent pending invitation for this email
  SELECT * INTO v_inv
  FROM   public.invitations
  WHERE  email       = v_auth_email
    AND  accepted_at IS NULL
  ORDER  BY created_at DESC
  LIMIT  1;

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'No pending invitation found for this email address.';
  END IF;

  -- Check whether a profile row already exists
  SELECT id INTO v_existing_id
  FROM   public.users
  WHERE  email = v_auth_email;

  IF v_existing_id IS NOT NULL THEN
    -- Profile exists — update it with the invitation's company/role
    UPDATE public.users
    SET    company_id = v_inv.company_id,
           role       = v_inv.role,
           name       = COALESCE(NULLIF(trim(p_user_name), ''), name)
    WHERE  id = v_existing_id;
  ELSE
    -- First time — insert a new profile row
    INSERT INTO public.users (name, email, role, company_id)
    VALUES (
      COALESCE(NULLIF(trim(p_user_name), ''), split_part(v_auth_email, '@', 1)),
      v_auth_email,
      v_inv.role,
      v_inv.company_id
    );
  END IF;

  -- Mark the invitation as accepted
  UPDATE public.invitations
  SET    accepted_at = now()
  WHERE  id = v_inv.id;

  RETURN json_build_object(
    'company_id', v_inv.company_id::text,
    'role',       v_inv.role
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_invitation TO authenticated;

-- Grant table-level access (RLS still applies)
GRANT ALL ON public.invitations TO authenticated;

-- Ensure authenticated users can read public.users profiles
-- (required for UserManagement page and FK constraint checks on invited_by)
GRANT SELECT ON public.users TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- STEP 3b — create_invitation FUNCTION
-- ────────────────────────────────────────────────────────────────
-- Called by company admins to generate an invite link for a new user.
-- SECURITY DEFINER bypasses RLS and the table-privilege check that
-- would otherwise fire when enforcing the invited_by FK on public.users,
-- fixing the "permission denied for table users" error.

CREATE OR REPLACE FUNCTION public.create_invitation(
  p_email text,
  p_role  text DEFAULT 'foreman'
)
  RETURNS json
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_email  text;
  v_company_id  uuid;
  v_caller_role text;
  v_caller_id   int;
  v_clean_email text;
  v_token       uuid;
BEGIN
  -- Resolve the calling user's email from the Supabase Auth session
  SELECT email INTO v_auth_email
  FROM   auth.users
  WHERE  id = auth.uid();

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up the caller's profile
  SELECT id, company_id, role INTO v_caller_id, v_company_id, v_caller_role
  FROM   public.users
  WHERE  email = v_auth_email;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Your account is not associated with a company';
  END IF;

  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admins can create invitations';
  END IF;

  -- Validate and normalise the target email (callers may pass raw input)
  v_clean_email := lower(trim(p_email));
  IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Invalid email address: %', p_email;
  END IF;

  -- Validate role value
  IF p_role NOT IN ('admin', 'foreman', 'crew') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Insert the invitation (runs as postgres, bypasses RLS/FK privilege check)
  INSERT INTO public.invitations (email, company_id, role, invited_by)
  VALUES (v_clean_email, v_company_id, p_role, v_caller_id)
  RETURNING invite_token INTO v_token;

  RETURN json_build_object(
    'invite_token', v_token::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invitation TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- STEP 4 — get_invitation_by_token FUNCTION
-- ────────────────────────────────────────────────────────────────
-- Called by the app when an unauthenticated user visits a
-- ?invite=<token> URL. Returns the invitation details so the app
-- can trigger signInWithOtp for the correct email.
-- Callable by anon since the user is not signed in yet.

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token uuid)
  RETURNS TABLE(id uuid, email text, company_id uuid, role text)
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id, email, company_id, role
  FROM   public.invitations
  WHERE  invite_token = p_token
    AND  accepted_at  IS NULL
  LIMIT  1
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token TO anon, authenticated;


-- =============================================================================
-- DONE!
--
-- Next steps:
--   1. Admins use the "Invite Team Members" section in Settings to generate
--      invite links. Each link embeds an invite_token UUID.
--   2. Admins copy the link and send it to the invitee (email, SMS, etc.).
--   3. Invitee clicks the link → app detects ?invite=<token> → calls
--      signInWithOtp for their email → invitee gets a magic sign-in email.
--   4. Invitee clicks the magic link → lands on Account Setup → enters name
--      → accept_invitation RPC creates their profile.
-- =============================================================================
