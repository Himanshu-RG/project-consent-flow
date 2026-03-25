-- Migration: Add PID field to users table
-- Date: 2026-02-17
-- Description: Adds unique person identifier (PID) field to users table and consent_pdf_path

-- Add PID column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pid VARCHAR(50) UNIQUE;

-- Add consent_pdf_path column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_pdf_path TEXT;

-- Create index on PID for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_pid ON users(pid);

-- Note: PIDs will be generated when users upload their identity images
