# ConsentMap Database Schema & Architecture

## Overview

ConsentMap uses **PostgreSQL** as its primary database, accessed via **SQLAlchemy ORM** with Pydantic schema validation. The database stores project data, uploaded images, ML-detected persons, consent forms, and audit events.

- **ORM**: SQLAlchemy 2.0 (declarative models)
- **Migrations**: SQL scripts in `backend/migrations/`
- **Connection**: Configured via `DATABASE_URL` environment variable
- **Default**: `postgresql://consentmap_user:consentmap_pass@localhost:5433/consentmap_db`

---

## Entity Relationship Diagram

```
USERS (1) ──────┬─────── (N) PROJECTS (1) ──────┬─────── (N) PERSONS
                │                                │              │
                │                                ├─── (N) IMAGES │
                │                                │        │      │
                │                                │     IMAGE_PERSON (M:N)
                │                                │
                │                                ├─── (N) CONSENT_FORMS
                │                                │
                │                                ├─── (N) GROUP_IMAGES
                │                                │
                │                                ├─── (N) DATA_ENTRIES
                │                                │
                └─────── (N) EVENTS ◄────────────┘

KNOWN_PERSONS (standalone — global face dataset)
```

---

## Table Definitions

### `known_persons` — Global Face Dataset

Reference table for known individuals. Populated at server startup from the `dataset_known` folder and via the Dataset Manager UI.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `pid` | VARCHAR(255) | UNIQUE, NOT NULL, INDEX | Person identifier (e.g., `"Arun.A"`) |
| `name` | VARCHAR(255) | NOT NULL | Person's display name |
| `image_path` | TEXT | — | Absolute path to reference face image |
| `embedding` | JSONB | — | FaceNet embedding vector (512-dim float list) |
| `created_at` | TIMESTAMP | DEFAULT now() | Record creation time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

---

### `users` — Authentication & Authorization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL, INDEX | Login email |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt-hashed password |
| `full_name` | VARCHAR(255) | — | Display name |
| `role` | VARCHAR(50) | CHECK (`admin`, `user`) | User role |
| `is_active` | BOOLEAN | DEFAULT true | Account active status |
| `created_at` | TIMESTAMP | DEFAULT now() | Registration time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

**Relationships:** `users.id` → `projects.owner_id`, `events.user_id`

---

### `projects` — Consent Mapping Projects

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `name` | VARCHAR(255) | NOT NULL | Project name |
| `description` | TEXT | — | Project description |
| `notes` | TEXT | — | Additional notes |
| `owner_id` | UUID | FK → `users.id` (SET NULL) | Project owner |
| `target_image_count` | INT | DEFAULT 0 | Target number of images |
| `status` | VARCHAR(50) | CHECK (`active`, `completed`, `on-hold`, `archived`) | Project status |
| `camera_dslr` | BOOLEAN | DEFAULT false | DSLR camera used |
| `camera_mobile` | BOOLEAN | DEFAULT false | Mobile camera used |
| `pii_face` | BOOLEAN | DEFAULT false | Collecting face data |
| `pii_objects` | BOOLEAN | DEFAULT false | Collecting object data |
| `pii_document` | BOOLEAN | DEFAULT false | Collecting document data |
| `pii_other` | BOOLEAN | DEFAULT false | Other PII |
| `created_at` | TIMESTAMP | DEFAULT now() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

**Cascade:** Deleting a project cascades to all child records (persons, images, consent_forms, group_images, data_entries, events).

---

### `persons` — ML-Detected Individuals

Each record represents a detected face matched against the known dataset within a specific project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `project_id` | UUID | FK → `projects.id` (CASCADE), NOT NULL | Parent project |
| `name` | VARCHAR(255) | NOT NULL | Person's name (from dataset match or "Unknown Person") |
| `pid` | VARCHAR(100) | — | Person identifier from dataset (e.g., `"Arun.A"`) |
| `confidence` | FLOAT | — | ML match confidence (0.0–1.0) |
| `bbox` | JSONB | — | Last detected bounding box `{x, y, width, height}` |
| `embedding` | JSONB | — | FaceNet face embedding vector |
| `consent_status` | VARCHAR(50) | CHECK (`pending`, `granted`, `denied`, `expired`) | Consent status |
| `notes` | TEXT | — | Additional notes |
| `created_at` | TIMESTAMP | DEFAULT now() | Detection time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

---

### `images` — Uploaded Project Images

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `project_id` | UUID | FK → `projects.id` (CASCADE), NOT NULL | Parent project |
| `name` | VARCHAR(255) | NOT NULL | Original filename |
| `file_url` | TEXT | — | URL path for serving (`/uploads/images/...`) |
| `file_path` | TEXT | — | Absolute filesystem path |
| `file_size` | INT | — | File size in bytes |
| `mime_type` | VARCHAR(100) | — | MIME type (`image/jpeg`, etc.) |
| `width` | INT | — | Image width in pixels |
| `height` | INT | — | Image height in pixels |
| `factor` | VARCHAR(100) | — | Image category (Individual, Group, etc.) |
| `batch_number` | VARCHAR(100) | — | Batch identifier |
| `camera_type` | VARCHAR(50) | CHECK (`dslr`, `mobile`, `other`) | Camera type |
| `metadata` | JSONB | — | Additional metadata (EXIF data, manual redaction boxes) |
| `created_at` | TIMESTAMP | DEFAULT now() | Upload time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

---

### `image_person` — Face Detection Junction Table (M:N)

Links detected persons to the images they appear in. Each row stores the **per-image** bounding box and detection confidence.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `image_id` | UUID | FK → `images.id` (CASCADE), NOT NULL | Source image |
| `person_id` | UUID | FK → `persons.id` (CASCADE), NOT NULL | Detected person |
| `is_primary` | BOOLEAN | DEFAULT false | Primary person in the image |
| `bbox` | JSONB | — | Face position in this image `{x, y, width, height}` |
| `confidence` | FLOAT | — | Match confidence for this detection |
| `consent_pid` | VARCHAR(255) | — | Best-match known-person PID (may be below threshold) |
| `created_at` | TIMESTAMP | DEFAULT now() | Detection time |

---

### `consent_forms` — Consent Documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `project_id` | UUID | FK → `projects.id` (CASCADE), NOT NULL | Parent project |
| `person_id` | UUID | FK → `persons.id` (SET NULL) | Linked person (from auto-match or manual) |
| `form_name` | VARCHAR(255) | NOT NULL | Original PDF filename |
| `file_url` | TEXT | — | URL path for serving |
| `file_path` | TEXT | — | Absolute filesystem path |
| `file_size` | INT | — | File size in bytes |
| `mime_type` | VARCHAR(100) | — | MIME type (`application/pdf`) |
| `is_matched` | BOOLEAN | DEFAULT false | Whether matched to a person |
| `signed_date` | TIMESTAMP | — | Date consent was signed |
| `expiry_date` | TIMESTAMP | — | Date consent expires |
| `created_at` | TIMESTAMP | DEFAULT now() | Upload time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

**Auto-matching:** When a PDF named `Arun.A.pdf` is uploaded, the system matches it to a person with `pid = "Arun.A"` and sets `consent_status = "granted"`.

---

### `group_images` — Group Photo Metadata

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `project_id` | UUID | FK → `projects.id` (CASCADE), NOT NULL | Parent project |
| `image_id` | UUID | FK → `images.id` (CASCADE), NOT NULL | Associated image |
| `name` | VARCHAR(255) | NOT NULL | Group photo name |
| `participant_count` | INT | DEFAULT 0 | Number of participants |
| `created_at` | TIMESTAMP | DEFAULT now() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

---

### `data_entries` — Data Processing Records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `project_id` | UUID | FK → `projects.id` (CASCADE), NOT NULL | Parent project |
| `person_id` | UUID | FK → `persons.id` (CASCADE) | Related person |
| `image_id` | UUID | FK → `images.id` (CASCADE) | Related image |
| `entry_type` | VARCHAR(50) | CHECK (`manual`, `automated`, `verified`) | Entry type |
| `status` | VARCHAR(50) | CHECK (`pending`, `processing`, `completed`, `failed`) | Processing status |
| `data` | JSONB | — | Entry data payload |
| `created_at` | TIMESTAMP | DEFAULT now() | Creation time |
| `updated_at` | TIMESTAMP | DEFAULT now() | Last update time |

---

### `events` — Audit Log

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Auto-generated |
| `project_id` | UUID | FK → `projects.id` (CASCADE), NOT NULL | Related project |
| `user_id` | UUID | FK → `users.id` (SET NULL) | Acting user |
| `event_type` | VARCHAR(100) | NOT NULL | Event type identifier |
| `description` | TEXT | — | Human-readable description |
| `metadata` | JSONB | — | Additional event data |
| `created_at` | TIMESTAMP | DEFAULT now() | Event timestamp |

**Event Types:** `project_created`, `project_updated`, `images_uploaded`, `image_deleted`, `person_added`, `person_updated`, `person_deleted`, `person_promoted`, `consent_uploaded`, `consent_deleted`

---

## Key Workflows

### 1. Image Processing Pipeline
```
Upload Images → Project.images[]
     ↓
POST /projects/{id}/process
     ↓
For each image:
  1. YOLOv8 face detection → bounding boxes
  2. FaceNet embedding extraction → 512-dim vector
  3. Cosine similarity vs. known_persons embeddings
  4. Create/update Person records
  5. Create ImagePerson junction records (per-image bbox + confidence)
     ↓
Auto-match consent PDFs → update consent_status
```

### 2. Consent Matching Flow
```
Upload PDFs (e.g., "Arun.A.pdf")
     ↓
Extract filename stem → "Arun.A"
     ↓
Find Person with pid = "Arun.A" in project
     ↓
Link consent_form.person_id → person.id
Set consent_form.is_matched = true
Set person.consent_status = "granted"
```

### 3. Redaction Logic
```
Request redacted image
     ↓
No detections? → Full Gaussian blur
     ↓
For each detected person:
  - pid set + consent_status = "granted" → Green box + name
  - pid = NULL or consent ≠ granted → Blur face + red box + "REDACTED"
     ↓
Apply manual redaction boxes from image.metadata
     ↓
Stream JPEG response (no disk write)
```
