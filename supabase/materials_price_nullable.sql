-- Migration: make materials.unit_price nullable so materials can be added
-- by name only (price to be filled in by admin later).
-- Safe to run on an existing database.

ALTER TABLE materials
  ALTER COLUMN unit_price DROP NOT NULL,
  ALTER COLUMN unit_price SET DEFAULT NULL;
