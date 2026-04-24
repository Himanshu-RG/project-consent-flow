-- ============================================================
-- Migration 004: Architecture Redesign
-- Moves from multi-user-enrollment model to fixed-account + dataset-based recognition
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Drop enrollment table (no more user → project enrollment)
-- ---------------------------------------------------------------
DROP TABLE IF EXISTS project_enrollments CASCADE;

-- ---------------------------------------------------------------
-- 2. Update users table: remove face/identity/consent columns,
--    restrict role to admin/user only
-- ---------------------------------------------------------------
ALTER TABLE users
    DROP COLUMN IF EXISTS pid,
    DROP COLUMN IF EXISTS identity_image_url,
    DROP COLUMN IF EXISTS face_embedding,
    DROP COLUMN IF EXISTS consent_pdf_url,
    DROP COLUMN IF EXISTS consent_pdf_path;

-- Update role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_role;
ALTER TABLE users ADD CONSTRAINT check_user_role
    CHECK (role IN ('admin', 'user'));

-- Set any 'viewer' roles to 'user'
UPDATE users SET role = 'user' WHERE role = 'viewer';

-- ---------------------------------------------------------------
-- 3. Redesign persons table:
--    - Remove: user_id, email, phone, consent_date, face_embedding, match_confidence
--    - Add:    pid (dataset person identifier), confidence (FLOAT), bbox (JSONB)
-- ---------------------------------------------------------------

-- Remove old columns
ALTER TABLE persons
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS consent_date,
    DROP COLUMN IF EXISTS face_embedding,
    DROP COLUMN IF EXISTS match_confidence;

-- Add new columns
ALTER TABLE persons
    ADD COLUMN IF NOT EXISTS pid VARCHAR(100),
    ADD COLUMN IF NOT EXISTS confidence FLOAT,
    ADD COLUMN IF NOT EXISTS bbox JSONB;

-- Add index on project_id + pid for fast lookups
CREATE INDEX IF NOT EXISTS idx_persons_project_pid ON persons(project_id, pid);

-- Clear existing person records (old data is incompatible with new schema)
-- NOTE: This will also cascade-delete image_person links and data_entries linked to persons
TRUNCATE TABLE persons CASCADE;

COMMIT;
