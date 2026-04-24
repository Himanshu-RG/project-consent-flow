# ConsentMap API Reference

> Base URL: `http://localhost:8000/api`

All endpoints return JSON unless otherwise noted. Authentication uses Bearer token via `Authorization` header where required.

---

## Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | ✗ | Register a new user account |
| `POST` | `/auth/login` | ✗ | Login with email/password |
| `POST` | `/auth/logout` | ✗ | Logout (client-side cleanup) |

### POST `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "min6chars",
  "full_name": "John Doe",
  "role": "user"
}
```

**Response:** `201 Created` — Returns `UserResponse`

### POST `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK` — Returns `UserResponse`

---

## Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users` | ✓ | List all active users |
| `GET` | `/users/me` | ✓ | Get current user profile |

---

## Projects

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/projects` | ✗ | Create project (multipart: metadata + images + PDFs) |
| `GET` | `/projects` | ✗ | List projects (paginated) |
| `GET` | `/projects/{id}` | ✗ | Get project by ID |
| `PUT` | `/projects/{id}` | ✗ | Update project metadata |
| `DELETE` | `/projects/{id}` | ✗ | Delete project (cascades all data) |

### POST `/projects` (Multipart Form)

Creates a project with optional bulk file upload.

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Project name |
| `description` | string | ✗ | Project description |
| `notes` | string | ✗ | Additional notes |
| `target_image_count` | int | ✗ | Target number of images |
| `project_status` | string | ✗ | `active` \| `completed` \| `on-hold` \| `archived` |
| `camera_dslr` | bool | ✗ | DSLR camera used |
| `camera_mobile` | bool | ✗ | Mobile camera used |
| `pii_face` | bool | ✗ | Collecting face data |
| `pii_objects` | bool | ✗ | Collecting object data |
| `pii_document` | bool | ✗ | Collecting document data |
| `pii_other` | bool | ✗ | Other PII types |
| `images` | File[] | ✗ | Image files (JPEG, PNG, BMP) |
| `consent_pdfs` | File[] | ✗ | Consent PDF files |

**Response:** `201 Created` — Returns `ProjectResponse`

### GET `/projects`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 10 | Items per page (max 100) |
| `status` | string | — | Filter by project status |

**Response:** `200 OK`
```json
{
  "projects": [ProjectResponse],
  "pagination": { "page": 1, "limit": 10, "total": 42, "total_pages": 5 }
}
```

---

## ML Processing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/projects/{id}/process` | ✗ | Start background ML processing |
| `GET` | `/projects/{id}/process/status/{task_id}` | ✗ | SSE stream for processing progress |

### POST `/projects/{id}/process`

Kicks off asynchronous face detection + recognition for all images in the project.

**Response:** `202 Accepted`
```json
{
  "task_id": "abc123",
  "project_id": "uuid",
  "status": "started",
  "message": "Processing 50 image(s) in the background..."
}
```

### GET `/projects/{id}/process/status/{task_id}` (SSE)

Returns a `text/event-stream`. Each event is a JSON object:

```json
{
  "task_id": "abc123",
  "status": "processing",
  "progress": 15,
  "total": 50,
  "current_image": "IMG_001.jpg"
}
```

Status values: `pending` → `processing` → `saving` → `done` | `error`

---

## Images

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/projects/{id}/images` | ✗ | Upload images to a project |
| `GET` | `/projects/{id}/images` | ✗ | List project images |
| `GET` | `/images/{id}` | ✗ | Get single image details |
| `DELETE` | `/images/{id}` | ✗ | Delete image (file + DB) |

### POST `/projects/{id}/images` (Multipart)

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File[] | ✓ | Image files |
| `factor` | string | ✗ | Category (Individual, Group, etc.) |
| `batch_number` | string | ✗ | Batch identifier |
| `camera_type` | string | ✗ | `dslr` \| `mobile` \| `other` |

**Response:** `201 Created` — Returns `ImageResponse[]`

---

## Persons (ML-Detected Individuals)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/known-persons` | ✗ | List all known persons in the global dataset |
| `POST` | `/known-persons/upload` | ✓ | Upload reference photo to global dataset |
| `DELETE` | `/known-persons/{pid}` | ✓ | Remove person from global dataset |
| `POST` | `/projects/{id}/persons` | ✓ | Manually create a person in a project |
| `GET` | `/projects/{id}/persons` | ✓ | List all detected persons in a project |
| `PUT` | `/persons/{id}` | ✓ | Update person (name, PID, consent) |
| `DELETE` | `/persons/{id}` | ✓ | Delete person record |
| `POST` | `/projects/{id}/persons/{pid}/promote` | ✓ | Promote unknown person to global dataset |

### POST `/known-persons/upload` (Multipart)

Upload a reference face image. If PID already exists, embeddings are averaged for better accuracy.

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Person's full name |
| `pid` | string | ✓ | Unique person identifier |
| `file` | File | ✓ | Face reference image |

### POST `/projects/{id}/persons/{pid}/promote`

Promotes an unknown detected person to the global known dataset using their extracted face embedding.

**Request Body:**
```json
{
  "name": "Person Name",
  "pid": "Person.ID"
}
```

---

## Consent Forms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/projects/{id}/consent` | ✗ | Upload consent PDFs (auto-matches by filename) |
| `POST` | `/projects/{id}/consent/match` | ✗ | Trigger consent → person matching |
| `GET` | `/projects/{id}/consent` | ✗ | List consent forms in a project |
| `PUT` | `/consent/{id}` | ✗ | Update consent form metadata |
| `DELETE` | `/consent/{id}` | ✗ | Delete consent form |
| `POST` | `/projects/{pid}/persons/{pid}/consent` | ✗ | Upload consent PDF for specific person |

### Consent Auto-Matching

When uploading consent PDFs, the system automatically matches them to detected persons:
- Filename `Arun.A.pdf` → matches person with `pid = "Arun.A"`
- Matched persons get `consent_status = "granted"`

---

## Redaction

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/projects/{id}/images/{img_id}/redacted` | ✗ | Get runtime-redacted image (JPEG stream) |
| `GET` | `/projects/{id}/redacted-images/zip` | ✗ | Download all redacted images as ZIP |
| `POST` | `/projects/{id}/images/{img_id}/manual-redact-upload` | ✗ | Save manual redaction boxes |
| `GET` | `/projects/{id}/images/{img_id}/manual-redact` | ✗ | Get stored manual redaction boxes |

### Redaction Logic

The redacted image endpoint applies consent-aware annotations:
- **Not processed** (no detections) → full Gaussian blur + "NOT PROCESSED" label
- **Consented persons** (consent_status = granted) → green bounding box + name label
- **Non-consented / Unknown** → Gaussian blur on face + red box + "REDACTED" label

---

## Excel Export

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/projects/{id}/export/excel` | ✗ | Download project metadata as Excel (.xlsx) |

**Excel Columns:** Image Name, Project, Category, Location, Human Presence, No. of Subjects, Person Names (dynamic), Consent Form Names (dynamic)

---

## Health & Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API info and version |
| `GET` | `/health` | Health check |

---

## Common Response Schemas

### UserResponse
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "admin",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### ProjectResponse
```json
{
  "id": "uuid",
  "name": "Project Name",
  "description": "...",
  "notes": "...",
  "owner_id": "uuid",
  "target_image_count": 100,
  "status": "active",
  "camera_dslr": true,
  "camera_mobile": false,
  "pii_face": true,
  "pii_objects": false,
  "pii_document": true,
  "pii_other": false,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

### PersonResponse
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Person Name",
  "pid": "Person.ID",
  "consent_status": "granted",
  "confidence": 0.95,
  "bbox": { "x": 100, "y": 50, "width": 200, "height": 250 },
  "image_url": "/uploads/images/...",
  "image_id": "uuid",
  "detections": [
    {
      "image_id": "uuid",
      "image_url": "/uploads/images/...",
      "bbox": { "x": 100, "y": 50, "width": 200, "height": 250 },
      "confidence": 0.95
    }
  ],
  "notes": null,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

### ImageResponse
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "IMG_001.jpg",
  "file_url": "/uploads/images/uuid/filename.jpg",
  "file_size": 1024000,
  "mime_type": "image/jpeg",
  "width": 4032,
  "height": 3024,
  "factor": "Individual",
  "batch_number": "B1",
  "camera_type": "dslr",
  "image_metadata": {},
  "created_at": "2026-01-01T00:00:00Z"
}
```

### ConsentFormResponse
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "person_id": "uuid",
  "form_name": "Arun.A.pdf",
  "file_url": "/uploads/consent_pdfs/uuid/filename.pdf",
  "file_size": 50000,
  "mime_type": "application/pdf",
  "is_matched": true,
  "signed_date": null,
  "expiry_date": null,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### MessageResponse
```json
{
  "message": "Operation completed successfully"
}
```

### ErrorResponse
```json
{
  "error": "error_type",
  "message": "Human-readable error description",
  "details": {}
}
```
