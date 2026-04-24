-- Migration 005: Create known_persons table
-- This table stores the lab dataset persons as a permanent reference.
-- Populated at startup by the ML pipeline from dataset_known folder.

BEGIN;

CREATE TABLE IF NOT EXISTS known_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pid VARCHAR(255) UNIQUE NOT NULL,     -- 'Arun.A' (filename without ext)
    name VARCHAR(255) NOT NULL,           -- 'Arun.A' (display name)
    image_path TEXT,                      -- absolute path to dataset image
    embedding JSONB,                      -- face embedding float array
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_known_persons_pid ON known_persons(pid);

COMMIT;
