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


-- =============================================================================
-- DONE!
--
-- Next steps:
--   1. Admins use the "Invite User" form in the app to create invitations.
--   2. The app sends a magic link via supabase.auth.signInWithOtp.
--   3. Invitees click the link, land on the Account Setup page, enter their
--      name, and accept_invitation completes their profile.
-- =============================================================================
