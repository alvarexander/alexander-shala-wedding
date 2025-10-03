-- Migration: convert guest_name and attending_guest_name to JSON arrays
-- Safely migrates existing string columns to JSON array columns.
-- Run in environments that already have guest_name / attending_guest_name.

START TRANSACTION;

-- Add new JSON columns if they don't already exist
ALTER TABLE rsvp_codes
  ADD COLUMN IF NOT EXISTS guest_names JSON NULL AFTER code,
  ADD COLUMN IF NOT EXISTS attending_guest_names JSON NULL AFTER guest_names;

-- Migrate guest_name -> guest_names as a single-element array
UPDATE rsvp_codes
SET guest_names = CASE
    WHEN guest_names IS NOT NULL THEN guest_names
    WHEN guest_name IS NULL OR guest_name = '' THEN JSON_ARRAY()
    ELSE JSON_ARRAY(guest_name)
END
WHERE guest_names IS NULL;

-- Migrate attending_guest_name -> attending_guest_names
UPDATE rsvp_codes
SET attending_guest_names = CASE
    WHEN attending_guest_names IS NOT NULL THEN attending_guest_names
    WHEN attending_guest_name IS NULL OR attending_guest_name = '' THEN JSON_ARRAY()
    ELSE JSON_ARRAY(attending_guest_name)
END
WHERE attending_guest_names IS NULL;

-- Drop old columns if present
ALTER TABLE rsvp_codes
  DROP COLUMN IF EXISTS guest_name,
  DROP COLUMN IF EXISTS attending_guest_name;

COMMIT;
