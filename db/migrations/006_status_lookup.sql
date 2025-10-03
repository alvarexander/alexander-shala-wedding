-- Migration 006: Replace rsvp_response ENUM with integer FK referencing a lookup table
-- This migration is intended for MySQL/MariaDB.
-- It creates a new rsvp_statuses lookup table, migrates existing data,
-- and replaces rsvp_codes.rsvp_response (ENUM) with rsvp_codes.status_id (INT FK).

START TRANSACTION;

-- 1) Create lookup table for statuses
CREATE TABLE IF NOT EXISTS rsvp_statuses (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,       -- machine code, e.g., 'pending', 'yes', 'no', 'yes partial party attendance'
  label VARCHAR(128) NOT NULL,     -- display label, e.g., 'Pending', 'Yes', 'No', 'Yes (Partial Party Attendance)'
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_rsvp_status_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Seed the canonical status values (id values will be assigned automatically)
INSERT INTO rsvp_statuses(code, label, sort_order)
VALUES
  ('pending', 'Pending', 0),
  ('yes', 'Yes', 10),
  ('no', 'No', 20),
  ('yes partial party attendance', 'Yes (Partial Party Attendance)', 15)
ON DUPLICATE KEY UPDATE code = VALUES(code), label = VALUES(label), sort_order = VALUES(sort_order);

-- 3) Add new FK column to rsvp_codes (nullable for the backfill step)
ALTER TABLE rsvp_codes
  ADD COLUMN IF NOT EXISTS status_id TINYINT UNSIGNED NULL AFTER party_size;

-- 4) Backfill status_id from the existing rsvp_response enum values
--    Note: Migration 005 added the lowercase partial status. If older data exists,
--    values will still map for 'pending','yes','no'.
UPDATE rsvp_codes rc
JOIN rsvp_statuses rs ON rs.code = rc.rsvp_response
SET rc.status_id = rs.id
WHERE rc.status_id IS NULL;

-- 5) For any rows not matched (unexpected/legacy), default to 'pending'
UPDATE rsvp_codes rc
LEFT JOIN rsvp_statuses rs ON rs.id = rc.status_id
SET rc.status_id = (SELECT id FROM rsvp_statuses WHERE code = 'pending' LIMIT 1)
WHERE rs.id IS NULL OR rc.status_id IS NULL;

-- 6) Enforce NOT NULL and add FK constraint
-- Note: MySQL does not support dynamic expressions in DEFAULT for FK, so we keep no DEFAULT and enforce NOT NULL
ALTER TABLE rsvp_codes
  MODIFY COLUMN status_id TINYINT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_rsvp_codes_status
    FOREIGN KEY (status_id) REFERENCES rsvp_statuses(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

-- 7) Drop the old ENUM column now that data is migrated
ALTER TABLE rsvp_codes
  DROP COLUMN IF EXISTS rsvp_response;

COMMIT;

-- Rollback (manual):
-- 1) ALTER TABLE rsvp_codes ADD COLUMN rsvp_response ENUM('pending','yes','no','yes partial party attendance') NOT NULL DEFAULT 'pending';
-- 2) UPDATE rsvp_codes rc JOIN rsvp_statuses rs ON rs.id = rc.status_id SET rc.rsvp_response = rs.code;
-- 3) ALTER TABLE rsvp_codes DROP FOREIGN KEY fk_rsvp_codes_status;
-- 4) ALTER TABLE rsvp_codes DROP COLUMN status_id;
