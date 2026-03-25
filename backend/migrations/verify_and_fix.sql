-- Step 1: Verify if match_confidence column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'persons' 
ORDER BY ordinal_position;

-- Step 2: If match_confidence is NOT in the list above, run this:
ALTER TABLE persons ADD COLUMN match_confidence INTEGER;

-- Step 3: Verify if consent_pdf_url exists in users table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Step 4: If consent_pdf_url is NOT in the list above, run this:
ALTER TABLE users ADD COLUMN consent_pdf_url TEXT;

-- Step 5: Check if project_enrollments table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'project_enrollments';

-- Step 6: If project_enrollments does NOT exist, run this:
CREATE TABLE project_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_enrollments_project_id ON project_enrollments(project_id);
CREATE INDEX idx_project_enrollments_user_id ON project_enrollments(user_id);
