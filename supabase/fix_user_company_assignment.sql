-- =============================================================================
-- Service Track Pro – Fix Orphaned Users & Assign Company
-- =============================================================================
-- Run this in your Supabase SQL editor (https://app.supabase.com → SQL Editor).
--
-- USE CASE: A user signed up but encounters one of these problems:
--   • Sign-up reports "User already registered" on a second attempt because
--     the auth account was created but the public profile was never saved.
--   • Signing in succeeds but the app shows "No Company Assigned" because
--     the user's public.users row has company_id = NULL.
--
-- INSTRUCTIONS
-- ─────────────
--  1. Run STEP 1 to identify which users are affected.
--  2. Run STEP 2 to see existing companies (or skip to STEP 3a to create one).
--  3. Run STEP 3a OR 3b to get/create the correct company UUID.
--  4. Run STEP 4 to create the missing public profile (if needed).
--  5. Run STEP 5 to assign the company to the user.
--  6. Run STEP 6 to confirm the fix worked.
--  7. Optionally run STEP 7 to install a reusable RPC function for super admins.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- STEP 1: Diagnose – find auth users missing a public profile or company
-- ---------------------------------------------------------------------------
SELECT
  au.id           AS auth_user_id,
  au.email,
  au.created_at   AS auth_created_at,
  pu.id           AS profile_id,
  pu.name         AS profile_name,
  pu.role,
  pu.company_id
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL            -- no profile at all
   OR pu.company_id IS NULL    -- profile exists but no company
ORDER BY au.created_at DESC;


-- ---------------------------------------------------------------------------
-- STEP 2: List existing companies
-- ---------------------------------------------------------------------------
SELECT id, name, created_at
FROM companies
ORDER BY created_at DESC;


-- ---------------------------------------------------------------------------
-- STEP 3a: Create a NEW company and retrieve its UUID
--           (skip this step if you are assigning to an existing company)
-- ---------------------------------------------------------------------------
-- Replace 'Your Company Name' with your actual company name.
INSERT INTO companies (name)
VALUES ('Your Company Name')
RETURNING id, name;
-- ↑ Copy the UUID from the result and paste it into STEP 4 / STEP 5.


-- ---------------------------------------------------------------------------
-- STEP 3b: Look up an EXISTING company by name
--           (use this instead of STEP 3a if the company already exists)
-- ---------------------------------------------------------------------------
-- Replace 'Your Company Name' with the exact company name.
SELECT id, name FROM companies WHERE name = 'Your Company Name';


-- ---------------------------------------------------------------------------
-- STEP 4: Create the public profile for an auth user who has none
--          Only needed when STEP 1 shows pu.id IS NULL for the user.
-- ---------------------------------------------------------------------------
-- Replace:
--   'user@example.com'   → the user's email address
--   'Full Name'          → the user's display name
--   'admin'              → role: 'admin' or 'foreman'
--   '<COMPANY_UUID>'     → the UUID from STEP 3a or 3b
INSERT INTO public.users (id, name, email, role, company_id)
SELECT
  au.id,
  'Full Name',                              -- ← replace with the user's name
  au.email,
  'admin',                                  -- ← 'admin' or 'foreman'
  '<COMPANY_UUID>'::uuid                    -- ← paste UUID from STEP 3
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE au.email = 'user@example.com'         -- ← replace with the user's email
  AND pu.id IS NULL                         -- guard: only insert if profile missing
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- STEP 5: Assign a company to an existing user whose company_id is NULL
--          Only needed when STEP 1 shows the profile exists but company_id
--          is NULL.
-- ---------------------------------------------------------------------------
-- Replace:
--   'user@example.com'   → the user's email address
--   '<COMPANY_UUID>'     → the UUID from STEP 3a or 3b
UPDATE public.users
SET company_id = '<COMPANY_UUID>'::uuid     -- ← paste UUID from STEP 3
WHERE email    = 'user@example.com';        -- ← replace with the user's email


-- ---------------------------------------------------------------------------
-- STEP 6: Verify the fix
-- ---------------------------------------------------------------------------
-- Replace 'user@example.com' with the user's email.
SELECT
  pu.id,
  pu.name,
  pu.email,
  pu.role,
  pu.company_id,
  c.name AS company_name
FROM public.users pu
LEFT JOIN companies c ON c.id = pu.company_id
WHERE pu.email = 'user@example.com';        -- ← replace with the user's email


-- =============================================================================
-- STEP 7 (OPTIONAL): Install a reusable RPC that a super_admin can call from
-- the Supabase dashboard or from the app to fix any user by email.
-- =============================================================================

-- 7a. Helper – assigns an existing or newly-created company to a user,
--     creating the public profile if it is missing.
--     Callable only by users whose role is 'super_admin'.
--
--     PREREQUISITE: The is_super_admin() helper function must already exist in
--     your database. It is created by schema_setup.sql / reset_schema.sql.
--     If you have not run those scripts yet, run schema_setup.sql first.

CREATE OR REPLACE FUNCTION assign_company_to_user(
  p_user_email  TEXT,
  p_company_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permission check: only super_admin may call this function
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: only a super_admin can assign companies to users';
  END IF;

  -- Verify the company exists
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'Company not found: %', p_company_id;
  END IF;

  -- If the public profile already exists, just update company_id
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_user_email) THEN
    UPDATE public.users
    SET company_id = p_company_id
    WHERE email = p_user_email;

  ELSE
    -- Profile missing – create it from auth.users metadata
    INSERT INTO public.users (id, name, email, role, company_id)
    SELECT
      au.id,
      COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        split_part(au.email, '@', 1)
      ),
      au.email,
      'admin',
      p_company_id
    FROM auth.users au
    WHERE au.email = p_user_email;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No auth user found with email: %', p_user_email;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_company_to_user(TEXT, UUID) TO authenticated;

-- 7b. Convenience variant that also creates the company in one call.
CREATE OR REPLACE FUNCTION assign_new_company_to_user(
  p_user_email   TEXT,
  p_company_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Permission check: only super_admin may call this function
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: only a super_admin can use this function';
  END IF;

  -- Create the company
  INSERT INTO public.companies (name)
  VALUES (p_company_name)
  RETURNING id INTO v_company_id;

  -- Assign it to the user (reuse function above)
  PERFORM assign_company_to_user(p_user_email, v_company_id);

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_new_company_to_user(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- Usage examples for the RPC functions (run as super_admin):
--
--   -- Assign an existing company to a user:
--   SELECT assign_company_to_user(
--     'user@example.com',
--     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid
--   );
--
--   -- Create a new company AND assign it to the user in one call:
--   SELECT assign_new_company_to_user(
--     'user@example.com',
--     'Acme Services'
--   );
-- =============================================================================
