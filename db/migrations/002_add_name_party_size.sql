-- Migration: add guest_name (up to 400 chars) and party_size to rsvp_codes
-- Run this if your rsvp_codes table already exists without these columns.

ALTER TABLE rsvp_codes
  ADD COLUMN guest_name VARCHAR(400) NULL AFTER code,
  ADD COLUMN party_size INT UNSIGNED NULL AFTER guest_name;
