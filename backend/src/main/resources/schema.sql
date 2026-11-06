-- ============================================================================
-- ALFAAZ OPEN MIC — COMPLETE DATABASE SCHEMA & INITIAL DATA
-- Database: MySQL 8.0+
-- Character Set: utf8mb4 / Collation: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `alfaaz_tickets` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `alfaaz_tickets`;

-- ----------------------------------------------------------------------------
-- Table 1: events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `organizer` VARCHAR(255) NOT NULL,
  `event_date_time` DATETIME(6) NOT NULL,
  `venue` VARCHAR(255) NOT NULL,
  `max_capacity` INT NOT NULL DEFAULT 40,
  `audience_price` DOUBLE NOT NULL DEFAULT 100.0,
  `performer_price` DOUBLE NOT NULL DEFAULT 100.0,
  `contact_phone` VARCHAR(255) NOT NULL DEFAULT '8624890246',
  `upi_id` VARCHAR(255) NOT NULL DEFAULT '8624890246@ibl',
  `active` BIT(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 2: admin_users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
  `created_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 3: bookings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `event_id` BIGINT NOT NULL,
  `booking_reference` VARCHAR(32) NOT NULL UNIQUE,
  `access_key` VARCHAR(64) NOT NULL UNIQUE,
  `full_name` VARCHAR(255) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(100) NOT NULL DEFAULT '',
  `ticket_type` VARCHAR(30) NOT NULL,
  `performer_category` VARCHAR(50) DEFAULT NULL,
  `performance_description` VARCHAR(1000) DEFAULT NULL,
  `amount` DOUBLE NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  `reserved_until` DATETIME(6) NOT NULL,
  `created_at` DATETIME(6) NOT NULL,
  `updated_at` DATETIME(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_booking_status` (`status`),
  INDEX `idx_booking_mobile` (`mobile`),
  CONSTRAINT `fk_booking_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 4: payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT NOT NULL UNIQUE,
  `amount` DOUBLE NOT NULL,
  `payment_method` VARCHAR(30) NOT NULL DEFAULT 'UPI',
  `utr_number` VARCHAR(64) DEFAULT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  `rejection_reason` VARCHAR(255) DEFAULT NULL,
  `submitted_at` DATETIME(6) DEFAULT NULL,
  `verified_at` DATETIME(6) DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_payment_utr` (`utr_number`),
  INDEX `idx_payment_status` (`status`),
  CONSTRAINT `fk_payment_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 5: tickets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT NOT NULL UNIQUE,
  `event_id` BIGINT NOT NULL,
  `ticket_number` VARCHAR(32) NOT NULL UNIQUE,
  `token` VARCHAR(128) NOT NULL UNIQUE,
  `buyer_name` VARCHAR(255) DEFAULT NULL,
  `buyer_phone` VARCHAR(255) DEFAULT NULL,
  `ticket_type` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'VALID',
  `attended` BIT(1) NOT NULL DEFAULT b'0',
  `created_at` DATETIME(6) DEFAULT NULL,
  `checked_in_at` DATETIME(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ticket_status` (`status`),
  CONSTRAINT `fk_ticket_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 6: check_ins
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `check_ins` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `ticket_id` BIGINT DEFAULT NULL,
  `token_scanned` VARCHAR(128) NOT NULL,
  `attendee_name` VARCHAR(255) DEFAULT NULL,
  `result` VARCHAR(50) NOT NULL,
  `scanned_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_checkin_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- SEED INITIAL ACTIVE EVENT (IF EMPTY)
-- ----------------------------------------------------------------------------
INSERT INTO `events` (
  `id`, `title`, `organizer`, `event_date_time`, `venue`, 
  `max_capacity`, `audience_price`, `performer_price`, `contact_phone`, `upi_id`, `active`
)
SELECT 1, 'Alfaaz Open Mic', 'Alfaaz', '2026-11-09 17:00:00.000000', 'Beyond Temptation, Ashegaon Road, Basmat', 40, 100.0, 100.0, '8624890246', '8624890246@ibl', b'1'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `events` WHERE `id` = 1);

-- Ensure correct details are updated if row exists
UPDATE `events` 
SET `title` = 'Alfaaz Open Mic',
    `organizer` = 'Alfaaz',
    `event_date_time` = '2026-11-09 17:00:00.000000',
    `venue` = 'Beyond Temptation, Ashegaon Road, Basmat',
    `max_capacity` = 40,
    `audience_price` = 100.0,
    `performer_price` = 100.0,
    `contact_phone` = '8624890246',
    `upi_id` = '8624890246@ibl',
    `active` = b'1'
WHERE `id` = 1;

-- ----------------------------------------------------------------------------
-- SEED DEFAULT ADMIN USER (admin / Alfaaz@2026)
-- BCrypt Hash: $2a$10$wO/R4w8zYmE6Nf3YV...
-- ----------------------------------------------------------------------------
INSERT INTO `admin_users` (`username`, `password_hash`, `role`, `created_at`)
SELECT 'admin', '$2a$10$iXq21gXpYf0s1j41FhH1e.w4j7G41M0e7C8o0FhLqU1V8P0C7B0bW', 'ADMIN', NOW(6)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `admin_users` WHERE `username` = 'admin');
