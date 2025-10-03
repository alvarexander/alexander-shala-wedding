-- Migration: add attending_guest_name (up to 400 chars) to rsvp_codes
-- Run this if your rsvp_codes table already exists without this column.

ALTER TABLE rsvp_codes
  ADD COLUMN attending_guest_name VARCHAR(400) NULL AFTER guest_name;
