/**
 * TypeScript types matching backend Pydantic schemas
 * These interfaces ensure type safety when communicating with the FastAPI backend
 */

// ============================================
// User Types
// ============================================

export interface UserBase {
    email: string;
    full_name?: string;
    role?: string;
}

export interface UserCreate extends UserBase {
    password: string;
}

export interface UserLogin {
    email: string;
    password: string;
}

export interface UserResponse extends UserBase {
    id: string;
    is_active: boolean;
    created_at: string;
}

export interface UserWithToken {
    user: UserResponse;
    token: string;
}

// ============================================
// Project Types
// ============================================

export interface ProjectBase {
    name: string;
    description?: string;
    notes?: string;
    target_image_count?: number;
    status?: 'active' | 'completed' | 'on-hold' | 'archived';
    camera_dslr?: boolean;
    camera_mobile?: boolean;
    pii_face?: boolean;
    pii_objects?: boolean;
    pii_document?: boolean;
    pii_other?: boolean;
}

export interface ProjectCreate extends ProjectBase { }

export interface ProjectUpdate {
    name?: string;
    description?: string;
    notes?: string;
    target_image_count?: number;
    status?: 'active' | 'completed' | 'on-hold' | 'archived';
    camera_dslr?: boolean;
    camera_mobile?: boolean;
    pii_face?: boolean;
    pii_objects?: boolean;
    pii_document?: boolean;
    pii_other?: boolean;
}

export interface ProjectResponse extends ProjectBase {
    id: string;
    owner_id?: string;
    created_at: string;
    updated_at: string;
}

export interface ProjectListResponse {
    projects: ProjectResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

// ============================================
// Person Types
// ============================================

export interface PersonBase {
    name: string;
    consent_status?: 'pending' | 'granted' | 'denied' | 'expired';
    notes?: string;
}

export interface PersonCreate extends PersonBase {
    pid?: string;
    confidence?: number;
    bbox?: { x: number; y: number; width: number; height: number };
}

export interface PersonUpdate {
    name?: string;
    pid?: string;
    consent_status?: 'pending' | 'granted' | 'denied' | 'expired';
    notes?: string;
}

export interface PersonDetection {
    image_id: string;
    image_url: string;
    bbox: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    confidence?: number;
}

export interface PersonResponse extends PersonBase {
    id: string;
    project_id: string;
    pid?: string;             // Person ID from dataset (e.g. 'Arun.A'), null for unknowns
    confidence?: number;      // ML match confidence 0.0 - 1.0
    bbox?: {                  // Bounding box from last detection
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    image_url?: string;       // URL of first image where this person was detected
    image_id?: string;        // ID of that image
    detections?: PersonDetection[]; // All detections corresponding to this person
    created_at: string;
    updated_at: string;
}

// ============================================
// Image Types
// ============================================

export interface ImageBase {
    name: string;
    factor?: string;
    batch_number?: string;
    camera_type?: 'dslr' | 'mobile' | 'other';
}

export interface ImageResponse extends ImageBase {
    id: string;
    project_id: string;
    file_url?: string;
    file_size?: number;
    mime_type?: string;
    width?: number;
    height?: number;
    image_metadata?: Record<string, any>;
    created_at: string;
}

// ============================================
// Consent Form Types
// ============================================

export interface ConsentFormBase {
    form_name: string;
    signed_date?: string;
    expiry_date?: string;
}

export interface ConsentFormCreate extends ConsentFormBase {
    person_id: string;
}

export interface ConsentFormUpdate {
    is_matched?: boolean;
    signed_date?: string;
    expiry_date?: string;
}

export interface ConsentFormResponse extends ConsentFormBase {
    id: string;
    project_id: string;
    person_id: string;
    file_url?: string;
    file_size?: number;
    mime_type?: string;
    is_matched: boolean;
    created_at: string;
}

// ============================================
// Event Types
// ============================================

export interface EventResponse {
    id: string;
    project_id: string;
    user_id?: string;
    event_type: string;
    description?: string;
    event_metadata?: Record<string, any>;
    created_at: string;
}

// ============================================
// Generic Response Types
// ============================================

export interface MessageResponse {
    message: string;
}

export interface ErrorResponse {
    error: string;
    message: string;
    details?: Record<string, any>;
}

// ============================================
// API Error Type
// ============================================

export class ApiError extends Error {
    constructor(
        public status: number,
        public statusText: string,
        public data?: ErrorResponse
    ) {
        super(data?.message || statusText);
        this.name = 'ApiError';
    }
}

export interface KnownPersonResponse {
    pid: string;
    name: string;
    image_url?: string;
}
