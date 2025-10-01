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
    code
    VARCHAR
(
    32
) NOT NULL,
    guest_name VARCHAR(400) NULL,
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

-- 2) Seed 40 unique codes in a "pending" state
INSERT INTO rsvp_codes (code, rsvp_response, rsvped_at, updated_at)
VALUES ('A001', 'pending', NULL, NULL),
       ('A002', 'pending', NULL, NULL),
       ('A003', 'pending', NULL, NULL),
       ('A004', 'pending', NULL, NULL),
       ('A005', 'pending', NULL, NULL),
       ('A006', 'pending', NULL, NULL),
       ('A007', 'pending', NULL, NULL),
       ('A008', 'pending', NULL, NULL),
       ('A009', 'pending', NULL, NULL),
       ('A010', 'pending', NULL, NULL),
       ('A011', 'pending', NULL, NULL),
       ('A012', 'pending', NULL, NULL),
       ('A013', 'pending', NULL, NULL),
       ('A014', 'pending', NULL, NULL),
       ('A015', 'pending', NULL, NULL),
       ('A016', 'pending', NULL, NULL),
       ('A017', 'pending', NULL, NULL),
       ('A018', 'pending', NULL, NULL),
       ('A019', 'pending', NULL, NULL),
       ('A020', 'pending', NULL, NULL),
       ('A021', 'pending', NULL, NULL),
       ('A022', 'pending', NULL, NULL),
       ('A023', 'pending', NULL, NULL),
       ('A024', 'pending', NULL, NULL),
       ('A025', 'pending', NULL, NULL),
       ('A026', 'pending', NULL, NULL),
       ('A027', 'pending', NULL, NULL),
       ('A028', 'pending', NULL, NULL),
       ('A029', 'pending', NULL, NULL),
       ('A030', 'pending', NULL, NULL),
       ('A031', 'pending', NULL, NULL),
       ('A032', 'pending', NULL, NULL),
       ('A033', 'pending', NULL, NULL),
       ('A034', 'pending', NULL, NULL),
       ('A035', 'pending', NULL, NULL),
       ('A036', 'pending', NULL, NULL),
       ('A037', 'pending', NULL, NULL),
       ('A038', 'pending', NULL, NULL),
       ('A039', 'pending', NULL, NULL),
       ('A040', 'pending', NULL, NULL);
