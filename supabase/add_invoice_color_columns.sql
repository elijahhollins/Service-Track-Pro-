-- Migration: Add header_color and accent_color columns to invoice_settings.
-- Run this in your Supabase SQL editor if you already have an invoice_settings table.

ALTER TABLE invoice_settings
  ADD COLUMN IF NOT EXISTS header_color TEXT NOT NULL DEFAULT '#0a142d',
  ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#c49614';
