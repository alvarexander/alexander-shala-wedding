-- Migration 005: Add new RSVP status value for partial attendance
-- This adds "yes partial party attendance" to the rsvp_response ENUM.
-- MySQL/MariaDB SQL:

START TRANSACTION;

ALTER TABLE rsvp_codes
  MODIFY COLUMN rsvp_response ENUM('pending','yes','no','yes partial party attendance') NOT NULL DEFAULT 'pending';

COMMIT;

-- To rollback (manual): change the ENUM back to ('pending','yes','no') if no rows contain the new value.
