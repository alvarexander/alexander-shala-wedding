-- Migration 007: Create rsvp_admins table for admin authentication
-- This table stores admin usernames and bcrypt password hashes.
-- No seed row is inserted here; the backend auth endpoint will bootstrap
-- a default 'admin' user with the previously used password on first run
-- (if the table is empty), hashing it with PHP's password_hash().

START TRANSACTION;

CREATE TABLE IF NOT EXISTS rsvp_admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_rsvp_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
