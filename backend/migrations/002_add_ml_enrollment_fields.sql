-- Migration: Add match_confidence and project_enrollments table
-- Date: 2026-02-17
-- Description: Adds match_confidence column to persons table and creates project_enrollments association table

-- Add match_confidence column to persons table
ALTER TABLE persons ADD COLUMN IF NOT EXISTS match_confidence INTEGER;

-- Add consent_pdf_url column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_pdf_url TEXT;

-- Create project_enrollments table for user-project assignments
CREATE TABLE IF NOT EXISTS project_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- Create indexes on project_enrollments for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_enrollments_project_id ON project_enrollments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_enrollments_user_id ON project_enrollments(user_id);

-- Note: To update the consent_status constraint, you may need to drop and recreate it
-- This is commented out to avoid errors if the constraint doesn't exist
-- Uncomment and run manually if needed:
-- ALTER TABLE persons DROP CONSTRAINT IF EXISTS check_consent_status;
-- ALTER TABLE persons ADD CONSTRAINT check_consent_status 
--     CHECK (consent_status IN ('pending', 'granted', 'denied', 'expired', 'missing'));
