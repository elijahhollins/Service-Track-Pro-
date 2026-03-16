-- =============================================================================
-- Service Track Pro — Create Super Admin Account
-- =============================================================================
--
-- Run this script in the Supabase SQL Editor when you need to bootstrap
-- an admin account and cannot sign in through the app.
--
-- HOW TO USE
-- ----------
-- 1. Open your Supabase project dashboard.
-- 2. Click "SQL Editor" in the left sidebar → "New query".
-- 3. Edit the three variables directly below (email, password, name, company).
-- 4. Paste the entire script and click "Run" (or press Ctrl+Enter).
-- 5. Sign in to the app with the email and password you chose.
--
-- SAFE TO RE-RUN: every INSERT uses ON CONFLICT DO NOTHING, so running the
-- script more than once will not create duplicate rows or overwrite data.
-- =============================================================================

DO $$
DECLARE
  -- ─── EDIT THESE VALUES ────────────────────────────────────────────────────
  v_email        text := 'admin@yourcompany.com';   -- sign-in email
  v_password     text := 'CHANGE_THIS_PASSWORD';    -- must be 8+ characters — change before running!
  v_display_name text := 'Super Admin';             -- shown in the app
  v_company_name text := 'My Company';              -- company name in the app
  -- ──────────────────────────────────────────────────────────────────────────

  v_uid        uuid;
  v_company_id uuid;
BEGIN

  -- ── 1. Create Supabase Auth account ──────────────────────────────────────
  -- Skip if an auth account with this email already exists.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role,
      email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated', 'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false
    );

    RAISE NOTICE 'Auth account created for %', v_email;
  ELSE
    -- Retrieve existing auth UID so v_uid is available for diagnostics.
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
    RAISE NOTICE 'Auth account already exists for % — skipping auth insert.', v_email;
  END IF;

  -- ── 2. Create or find the company ─────────────────────────────────────────
  SELECT id INTO v_company_id
  FROM   public.companies
  WHERE  lower(name) = lower(v_company_name)
  LIMIT  1;

  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (name)
    VALUES (v_company_name)
    RETURNING id INTO v_company_id;

    RAISE NOTICE 'Company "%" created with id %', v_company_name, v_company_id;
  ELSE
    RAISE NOTICE 'Company "%" already exists (id %) — reusing it.', v_company_name, v_company_id;
  END IF;

  -- ── 3. Create the public.users profile ────────────────────────────────────
  -- ON CONFLICT (email) DO NOTHING keeps this safe if run more than once.
  -- If the profile exists but is missing a company, update it.
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = v_email) THEN
    INSERT INTO public.users (name, email, role, company_id)
    VALUES (v_display_name, v_email, 'admin', v_company_id);

    RAISE NOTICE 'User profile created for %', v_email;
  ELSE
    -- Make sure the existing profile is tied to the company and has admin role.
    UPDATE public.users
    SET    company_id = COALESCE(company_id, v_company_id),
           role       = 'admin'
    WHERE  email = v_email
      AND (role != 'admin' OR company_id IS NULL OR company_id != v_company_id);

    RAISE NOTICE 'User profile for % already exists — ensured admin role.', v_email;
  END IF;

END $$;

-- =============================================================================
-- Done!
--
-- You can now sign in at the app with:
--   Email    : <the email you set above>
--   Password : <the password you set above>
--
-- After signing in, go to Settings → User Management to invite other team
-- members or change passwords through the Supabase Auth dashboard.
-- =============================================================================
