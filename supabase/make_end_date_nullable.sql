-- Make end_date nullable on the jobs table so jobs can be created without an end date.
-- Run this in your Supabase SQL editor (https://app.supabase.com → SQL Editor).

ALTER TABLE jobs ALTER COLUMN end_date DROP NOT NULL;
