-- =============================================================================
-- Service Track Pro — Create Super Admin Account
-- =============================================================================
--
-- The super admin is the platform owner.  They are NOT tied to any company;
-- instead they can create companies and generate the initial admin invite
-- link for each one through the Super Admin Console in the app.
--
-- HOW TO USE
-- ----------
-- 1. Open your Supabase project dashboard.
-- 2. Click "SQL Editor" in the left sidebar → "New query".
-- 3. Edit the values directly below (email, password, display name).
-- 4. Paste the entire script and click "Run" (or press Ctrl+Enter).
-- 5. Sign in to the app with the email and password you chose.
--    You will land on the Super Admin Console — no company setup required.
--
-- SAFE TO RE-RUN: every statement uses ON CONFLICT / IF NOT EXISTS so
-- running it more than once will not create duplicates or overwrite data.
-- =============================================================================

DO $$
DECLARE
  -- ─── EDIT THESE VALUES ────────────────────────────────────────────────────
  v_email        text := 'superadmin@yourplatform.com';  -- sign-in email
  v_password     text := 'CHANGE_THIS_PASSWORD';         -- must be 8+ characters
  v_display_name text := 'Super Admin';                  -- shown in the app
  -- ──────────────────────────────────────────────────────────────────────────

  v_uid uuid;
BEGIN

  -- ── 1. Create Supabase Auth account ──────────────────────────────────────
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
    SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
    RAISE NOTICE 'Auth account already exists for % — skipping auth insert.', v_email;
  END IF;

  -- ── 2. Create the public.users profile (super_admin, no company) ──────────
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email = v_email) THEN
    INSERT INTO public.users (name, email, role, company_id)
    VALUES (v_display_name, v_email, 'super_admin', NULL);

    RAISE NOTICE 'Super admin profile created for %', v_email;
  ELSE
    -- Ensure existing profile has the super_admin role
    UPDATE public.users
    SET    role       = 'super_admin',
           company_id = NULL
    WHERE  email = v_email
      AND  role  IS DISTINCT FROM 'super_admin';

    RAISE NOTICE 'User profile for % already exists — ensured super_admin role.', v_email;
  END IF;

END $$;

-- =============================================================================
-- Done!
--
-- Sign in at the app with:
--   Email    : <the email you set above>
--   Password : <the password you set above>
--
-- You will land on the Super Admin Console where you can:
--   • Create companies
--   • Generate admin invite links for each company
-- Company admins then use Settings → Invite Team Members to onboard foremen.
-- =============================================================================
