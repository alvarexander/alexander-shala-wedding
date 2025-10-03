-- SQL schema and seed data for RSVP functionality
-- Database: wedding (or configure via your environment)

-- 1) Create table
CREATE TABLE IF NOT EXISTS rsvp_codes
(
    id
    INT
    UNSIGNED
    NOT
    NULL
    AUTO_INCREMENT,
    code CHAR(36) NOT NULL,
    guest_names JSON NULL,
    attending_guest_names JSON NULL,
    party_size INT UNSIGNED NULL,
    rsvp_response ENUM
(
    'pending',
    'yes',
    'no'
) NOT NULL DEFAULT 'pending',
    rsvped_at DATETIME NULL,
    updated_at DATETIME NULL,
    PRIMARY KEY
(
    id
),
    UNIQUE KEY uniq_code
(
    code
)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE =utf8mb4_unicode_ci;

-- 2) Seed 40 unique codes in a "pending" state (use UUIDs for stronger secrecy)
-- Note: UUID() returns a new value per row.
INSERT INTO rsvp_codes (code, rsvp_response, rsvped_at, updated_at)
VALUES (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL),
       (UUID(), 'pending', NULL, NULL);

-- 3) One-time update to convert existing short codes to UUIDs (run manually on old data):
-- UPDATE rsvp_codes SET code = UUID() WHERE CHAR_LENGTH(code) < 36 OR code NOT LIKE '%-%';
