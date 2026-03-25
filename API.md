# ConsentMap REST API Specification

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints (except login/register) require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 1. Authentication Endpoints

### 1.1 Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "user"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  },
  "token": "jwt_token"
}
```

### 1.2 Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  },
  "token": "jwt_token"
}
```

### 1.3 Get Current User
```http
GET /auth/me
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 1.4 Logout
```http
POST /auth/logout
```

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

---

## 2. Project Endpoints

### 2.1 Create Project
```http
POST /projects
```

**Request Body:**
```json
{
  "name": "Project Name",
  "description": "Project description",
  "notes": "Additional notes",
  "target_image_count": 100,
  "status": "active",
  "camera_dslr": true,
  "camera_mobile": false,
  "pii_face": true,
  "pii_objects": false,
  "pii_document": true,
  "pii_other": false
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Project Name",
  "description": "Project description",
  "notes": "Additional notes",
  "owner_id": "uuid",
  "target_image_count": 100,
  "status": "active",
  "camera_dslr": true,
  "camera_mobile": false,
  "pii_face": true,
  "pii_objects": false,
  "pii_document": true,
  "pii_other": false,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 2.2 List Projects
```http
GET /projects?page=1&limit=10&status=active
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (active, completed, on-hold, archived)

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description",
      "status": "active",
      "owner_id": "uuid",
      "target_image_count": 100,
      "image_count": 45,
      "person_count": 12,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "total_pages": 3
  }
}
```

### 2.3 Get Project Details
```http
GET /projects/:id
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Project Name",
  "description": "Project description",
  "notes": "Additional notes",
  "owner_id": "uuid",
  "owner": {
    "id": "uuid",
    "full_name": "John Doe",
    "email": "user@example.com"
  },
  "target_image_count": 100,
  "status": "active",
  "camera_dslr": true,
  "camera_mobile": false,
  "pii_face": true,
  "pii_objects": false,
  "pii_document": true,
  "pii_other": false,
  "images": [],
  "groupImages": [],
  "consentForms": [],
  "persons": [],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 2.4 Update Project
```http
PUT /projects/:id
```

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "notes": "Updated notes",
  "target_image_count": 150,
  "status": "completed",
  "camera_dslr": true,
  "camera_mobile": true,
  "pii_face": true,
  "pii_objects": true,
  "pii_document": false,
  "pii_other": false
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Updated Project Name",
  "description": "Updated description",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### 2.5 Delete Project
```http
DELETE /projects/:id
```

**Response:** `204 No Content`

---

## 3. Person Endpoints

### 3.1 Create Person
```http
POST /projects/:projectId/persons
```

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "consent_status": "pending",
  "notes": "Additional notes"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "consent_status": "pending",
  "consent_date": null,
  "notes": "Additional notes",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 3.2 List Persons in Project
```http
GET /projects/:projectId/persons
```

**Response:** `200 OK`
```json
{
  "persons": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "phone": "+1234567890",
      "consent_status": "granted",
      "consent_date": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3.3 Update Person
```http
PUT /persons/:id
```

**Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "consent_status": "granted",
  "consent_date": "2024-01-01T00:00:00Z"
}
```

**Response:** `200 OK`

### 3.4 Delete Person
```http
DELETE /persons/:id
```

**Response:** `204 No Content`

---

## 4. Image Endpoints

### 4.1 Upload Images
```http
POST /projects/:projectId/images
Content-Type: multipart/form-data
```

**Request Body:**
```
files: [File, File, ...]
factor: "Individual" | "Group"
batch_number: "BATCH001"
camera_type: "dslr" | "mobile" | "other"
```

**Response:** `201 Created`
```json
{
  "images": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "name": "image1.jpg",
      "file_url": "https://storage.example.com/images/uuid.jpg",
      "file_size": 1024000,
      "mime_type": "image/jpeg",
      "width": 1920,
      "height": 1080,
      "factor": "Individual",
      "batch_number": "BATCH001",
      "camera_type": "dslr",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 4.2 List Images in Project
```http
GET /projects/:projectId/images?batch_number=BATCH001
```

**Response:** `200 OK`
```json
{
  "images": [
    {
      "id": "uuid",
      "name": "image1.jpg",
      "file_url": "https://storage.example.com/images/uuid.jpg",
      "file_size": 1024000,
      "factor": "Individual",
      "batch_number": "BATCH001",
      "camera_type": "dslr",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 4.3 Get Image Details
```http
GET /images/:id
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "image1.jpg",
  "file_url": "https://storage.example.com/images/uuid.jpg",
  "file_path": "/uploads/images/uuid.jpg",
  "file_size": 1024000,
  "mime_type": "image/jpeg",
  "width": 1920,
  "height": 1080,
  "factor": "Individual",
  "batch_number": "BATCH001",
  "camera_type": "dslr",
  "metadata": {},
  "persons": [
    {
      "id": "uuid",
      "name": "Jane Smith",
      "is_primary": true
    }
  ],
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 4.4 Delete Image
```http
DELETE /images/:id
```

**Response:** `204 No Content`

### 4.5 Link Person to Image
```http
POST /images/:imageId/persons
```

**Request Body:**
```json
{
  "person_id": "uuid",
  "is_primary": true
}
```

**Response:** `201 Created`

---

## 5. Consent Form Endpoints

### 5.1 Upload Consent Form
```http
POST /projects/:projectId/consent
Content-Type: multipart/form-data
```

**Request Body:**
```
file: File
person_id: "uuid"
form_name: "Consent Form - Jane Smith"
signed_date: "2024-01-01"
expiry_date: "2025-01-01"
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "person_id": "uuid",
  "form_name": "Consent Form - Jane Smith",
  "file_url": "https://storage.example.com/consent/uuid.pdf",
  "file_size": 512000,
  "mime_type": "application/pdf",
  "is_matched": false,
  "signed_date": "2024-01-01T00:00:00Z",
  "expiry_date": "2025-01-01T00:00:00Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 5.2 List Consent Forms in Project
```http
GET /projects/:projectId/consent
```

**Response:** `200 OK`
```json
{
  "consentForms": [
    {
      "id": "uuid",
      "person_id": "uuid",
      "person_name": "Jane Smith",
      "form_name": "Consent Form - Jane Smith",
      "file_url": "https://storage.example.com/consent/uuid.pdf",
      "is_matched": true,
      "signed_date": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 5.3 Update Consent Form
```http
PUT /consent/:id
```

**Request Body:**
```json
{
  "is_matched": true,
  "signed_date": "2024-01-01",
  "expiry_date": "2025-01-01"
}
```

**Response:** `200 OK`

### 5.4 Delete Consent Form
```http
DELETE /consent/:id
```

**Response:** `204 No Content`

---

## 6. Group Image Endpoints

### 6.1 Create Group Image
```http
POST /projects/:projectId/group-images
```

**Request Body:**
```json
{
  "image_id": "uuid",
  "name": "Group Photo - Team A",
  "participant_count": 5
}
```

**Response:** `201 Created`

### 6.2 List Group Images
```http
GET /projects/:projectId/group-images
```

**Response:** `200 OK`

---

## 7. Data Entry Endpoints

### 7.1 Create Data Entry
```http
POST /projects/:projectId/data-entries
```

**Request Body:**
```json
{
  "person_id": "uuid",
  "image_id": "uuid",
  "entry_type": "manual",
  "status": "pending",
  "data": {
    "custom_field1": "value1",
    "custom_field2": "value2"
  }
}
```

**Response:** `201 Created`

### 7.2 List Data Entries
```http
GET /projects/:projectId/data-entries?status=completed
```

**Response:** `200 OK`

### 7.3 Update Data Entry
```http
PUT /data-entries/:id
```

**Request Body:**
```json
{
  "status": "completed",
  "data": {
    "processed": true
  }
}
```

**Response:** `200 OK`

---

## 8. Event/Timeline Endpoints

### 8.1 Get Project Timeline
```http
GET /projects/:projectId/events?limit=50
```

**Response:** `200 OK`
```json
{
  "events": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "user_id": "uuid",
      "user_name": "John Doe",
      "event_type": "project_created",
      "description": "Project created",
      "metadata": {},
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## 9. Statistics Endpoints

### 9.1 Get Project Statistics
```http
GET /projects/:projectId/stats
```

**Response:** `200 OK`
```json
{
  "total_images": 45,
  "total_persons": 12,
  "total_consent_forms": 10,
  "consent_granted": 8,
  "consent_pending": 2,
  "consent_denied": 0,
  "images_by_camera": {
    "dslr": 30,
    "mobile": 15
  },
  "images_by_batch": {
    "BATCH001": 20,
    "BATCH002": 25
  }
}
```

### 9.2 Get Dashboard Statistics
```http
GET /stats/dashboard
```

**Response:** `200 OK`
```json
{
  "total_projects": 5,
  "active_projects": 3,
  "total_images": 250,
  "total_persons": 50,
  "recent_activity": []
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

- Rate limit: 100 requests per minute per IP
- Header: `X-RateLimit-Remaining`
- When exceeded: `429 Too Many Requests`

---

## File Upload Limits

- Maximum file size: 10MB per file
- Supported image formats: JPEG, PNG, WEBP
- Supported document formats: PDF
- Maximum files per request: 10

---

## Notes

1. All timestamps are in ISO 8601 format (UTC)
2. All IDs are UUIDs
3. File URLs are pre-signed URLs valid for 1 hour
4. Pagination uses cursor-based pagination for large datasets
5. All endpoints support CORS for frontend integration
