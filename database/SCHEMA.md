-- Database Schema Diagram (Text Representation)
-- 
-- USERS (1) ──────┬─────── (N) PROJECTS (1) ──────┬─────── (N) PERSONS
--                 │                                │
--                 │                                ├─────── (N) IMAGES
--                 │                                │
--                 │                                ├─────── (N) CONSENT_FORMS
--                 │                                │
--                 │                                ├─────── (N) GROUP_IMAGES
--                 │                                │
--                 │                                ├─────── (N) DATA_ENTRIES
--                 │                                │
--                 └─────── (N) EVENTS              └─────── (N) EVENTS
--
-- IMAGE_PERSON: Many-to-Many relationship between IMAGES and PERSONS
--
-- Key Relationships:
-- - One USER can own many PROJECTS
-- - One PROJECT can have many PERSONS, IMAGES, CONSENT_FORMS, etc.
-- - One PERSON can have many CONSENT_FORMS
-- - One IMAGE can be associated with many PERSONS (via IMAGE_PERSON)
-- - One PERSON can appear in many IMAGES (via IMAGE_PERSON)

-- Quick Reference: Table Columns

/*
USERS:
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- full_name (VARCHAR)
- role (VARCHAR: admin|user|viewer)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)

PROJECTS:
- id (UUID, PK)
- name (VARCHAR)
- description, notes (TEXT)
- owner_id (UUID, FK -> users)
- target_image_count (INT)
- status (VARCHAR: active|completed|on-hold|archived)
- camera_dslr, camera_mobile (BOOLEAN)
- pii_face, pii_objects, pii_document, pii_other (BOOLEAN)
- created_at, updated_at (TIMESTAMP)

PERSONS:
- id (UUID, PK)
- project_id (UUID, FK -> projects)
- name, email, phone (VARCHAR)
- consent_status (VARCHAR: pending|granted|denied|expired)
- consent_date (TIMESTAMP)
- notes (TEXT)
- created_at, updated_at (TIMESTAMP)

CONSENT_FORMS:
- id (UUID, PK)
- project_id (UUID, FK -> projects)
- person_id (UUID, FK -> persons)
- form_name (VARCHAR)
- file_url, file_path (TEXT)
- file_size (BIGINT)
- mime_type (VARCHAR)
- is_matched (BOOLEAN)
- signed_date, expiry_date (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)

IMAGES:
- id (UUID, PK)
- project_id (UUID, FK -> projects)
- name (VARCHAR)
- file_url, file_path (TEXT)
- file_size (BIGINT)
- mime_type (VARCHAR)
- width, height (INT)
- factor, batch_number (VARCHAR)
- camera_type (VARCHAR: dslr|mobile|other)
- metadata (JSONB)
- created_at, updated_at (TIMESTAMP)

GROUP_IMAGES:
- id (UUID, PK)
- project_id (UUID, FK -> projects)
- image_id (UUID, FK -> images)
- name (VARCHAR)
- participant_count (INT)
- created_at, updated_at (TIMESTAMP)

IMAGE_PERSON (Junction Table):
- id (UUID, PK)
- image_id (UUID, FK -> images)
- person_id (UUID, FK -> persons)
- is_primary (BOOLEAN)
- created_at (TIMESTAMP)
- UNIQUE(image_id, person_id)

DATA_ENTRIES:
- id (UUID, PK)
- project_id (UUID, FK -> projects)
- person_id (UUID, FK -> persons)
- image_id (UUID, FK -> images)
- entry_type (VARCHAR: manual|automated|verified)
- status (VARCHAR: pending|processing|completed|failed)
- data (JSONB)
- created_at, updated_at (TIMESTAMP)

EVENTS:
- id (UUID, PK)
- project_id (UUID, FK -> projects)
- user_id (UUID, FK -> users)
- event_type (VARCHAR)
- description (TEXT)
- metadata (JSONB)
- created_at (TIMESTAMP)
*/
