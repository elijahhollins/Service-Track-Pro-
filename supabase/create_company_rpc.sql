-- =============================================================================
-- create_company RPC
-- Run this in your Supabase SQL editor if you encounter:
--   "new row violates row-level security policy for table companies"
--
-- This SECURITY DEFINER function lets an authenticated admin user who has no
-- company yet create one atomically (insert into companies + update their
-- own profile) without being blocked by RLS policies.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_company(company_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Only allow admin users who do not yet belong to a company
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
      AND company_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied: only an admin user without an existing company can call create_company';
  END IF;

  -- Create the company
  INSERT INTO public.companies (name)
  VALUES (company_name)
  RETURNING id INTO v_company_id;

  -- Link the calling user to the new company
  UPDATE public.users
  SET company_id = v_company_id
  WHERE id = auth.uid();

  RETURN v_company_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_company(TEXT) TO authenticated;
