"""
Simple migration script to add pid and consent_pdf_path columns.
Fixes the login 500 error.
"""
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv('backend/.env')

# Get database URL
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env file")
    exit(1)

print("Connecting to database...")

# Create engine
engine = create_engine(DATABASE_URL)

migration_sql = """
-- Add PID column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pid VARCHAR(50) UNIQUE;

-- Add consent_pdf_path column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_pdf_path TEXT;

-- Create index on PID for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_pid ON users(pid);
"""

try:
    with engine.connect() as connection:
        # Execute migration
        connection.execute(text(migration_sql))
        connection.commit()
    
    print("SUCCESS: Migration completed!")
    print("   - Added 'pid' column to users table")
    print("   - Added 'consent_pdf_path' column to users table")
    print("   - Created index on 'pid' column")
    print("\nYou can now login successfully!")
    
except Exception as e:
    print(f"ERROR: Migration failed: {e}")
    exit(1)
