-- Invoice branding settings – one row per company.
-- Run this in your Supabase SQL editor (https://app.supabase.com → SQL Editor).

CREATE TABLE IF NOT EXISTS invoice_settings (
  id              BIGSERIAL PRIMARY KEY,
  company_id      UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL DEFAULT 'Service Track Pro',
  company_address TEXT NOT NULL DEFAULT '123 Service Way, Industrial Park, Springfield, ST 55555',
  company_phone   TEXT NOT NULL DEFAULT '(555) 123-4567',
  company_email   TEXT NOT NULL DEFAULT 'billing@servicetrackpro.com',
  logo_initials   TEXT NOT NULL DEFAULT 'STP',
  payment_terms   TEXT NOT NULL DEFAULT 'Payment due within 30 days. Checks payable to the company above. Late payments subject to 1.5% monthly finance charge.',
  header_color    TEXT NOT NULL DEFAULT '#0a142d',
  accent_color    TEXT NOT NULL DEFAULT '#c49614',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;

-- Allow company members to read their own settings
CREATE POLICY "invoice_settings_select" ON invoice_settings
  FOR SELECT USING (company_id = get_my_company_id());

-- Allow admins to insert/update their own company settings
CREATE POLICY "invoice_settings_insert" ON invoice_settings
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "invoice_settings_update" ON invoice_settings
  FOR UPDATE USING (company_id = get_my_company_id());
