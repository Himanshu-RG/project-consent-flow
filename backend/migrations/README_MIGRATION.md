# Database Migration Instructions

## Migration: Add PID Field to Users Table

### File Location
`backend/migrations/003_add_pid_field.sql`

### What This Migration Does
- Adds `pid` (VARCHAR(50), UNIQUE) column to users table for unique person identification
- Adds `consent_pdf_path` (TEXT) column to users table for file system paths
- Creates index on `pid` column for fast lookups

### How to Run

#### Option 1: Using psql (if installed)
```powershell
# From project root directory
psql $env:DATABASE_URL -f backend/migrations/003_add_pid_field.sql
```

#### Option 2: Using Database GUI (pgAdmin, DBeaver, etc.)
1. Open your database management tool
2. Connect to your database
3. Open and execute `backend/migrations/003_add_pid_field.sql`

#### Option 3: Manual SQL Execution
Connect to your database and run:

```sql
-- Add PID column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pid VARCHAR(50) UNIQUE;

-- Add consent_pdf_path column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_pdf_path TEXT;

-- Create index on PID for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_pid ON users(pid);
```

### Verification

After running the migration, verify the changes:

```sql
-- Check that columns were added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('pid', 'consent_pdf_path');

-- Check that index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users'
AND indexname = 'idx_users_pid';
```

Expected results:
- `pid` column: VARCHAR(50), UNIQUE
- `consent_pdf_path` column: TEXT
- `idx_users_pid` index exists

### Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove index
DROP INDEX IF EXISTS idx_users_pid;

-- Remove columns
ALTER TABLE users DROP COLUMN IF EXISTS pid;
ALTER TABLE users DROP COLUMN IF EXISTS consent_pdf_path;
```

## Notes

- The migration uses `IF NOT EXISTS` / `IF EXISTS` clauses, so it's safe to run multiple times
- Existing user records will have NULL values for `pid` and `consent_pdf_path`
- PIDs will be automatically generated when users upload their identity images
- The `pid` column has a UNIQUE constraint to ensure no duplicates
