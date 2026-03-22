-- =============================================================================
-- Service Track Pro – register_with_company RPC
-- =============================================================================
-- Run this in your Supabase SQL editor (https://app.supabase.com → SQL Editor)
-- BEFORE the first user signs up.
--
-- PURPOSE:
--   Replaces the multi-step client-side inserts (create company → insert user)
--   with a single atomic, idempotent SECURITY DEFINER call that:
--     • Bypasses all Row-Level Security policies (runs as postgres superuser)
--     • Works even before the user confirms their email (callable by anon role)
--     • Creates the company row if a company name is supplied
--     • Creates (or patches) the public.users profile
--     • Is safe to call twice — ON CONFLICT updates only the fields that are
--       still missing/blank so retries never clobber good data
--
-- REQUIRES:
--   • The companies and public.users tables must already exist (schema_setup.sql)
-- =============================================================================

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
  -- ----------------------------------------------------------------
  -- Security gate: ensure the supplied user_id + email pair actually
  -- exists in auth.users to prevent spoofed registrations.
  -- ----------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id AND email = p_email
  ) THEN
    RAISE EXCEPTION 'register_with_company: user id/email mismatch or user does not exist';
  END IF;

  -- ----------------------------------------------------------------
  -- Company: use the supplied UUID or create a new company row.
  -- ----------------------------------------------------------------
  v_company_id := p_company_id;

  IF v_company_id IS NULL
     AND p_company_name IS NOT NULL
     AND trim(p_company_name) <> ''
  THEN
    INSERT INTO public.companies (name)
    VALUES (trim(p_company_name))
    RETURNING id INTO v_company_id;
  END IF;

  -- ----------------------------------------------------------------
  -- Profile: insert on first call; on retry, fill in only the gaps
  -- so a second call never overwrites a good name or company.
  -- ----------------------------------------------------------------
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

-- Grant to anon so it works before email confirmation, and to authenticated.
GRANT EXECUTE ON FUNCTION register_with_company(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION register_with_company(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
