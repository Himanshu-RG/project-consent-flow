"""
Pydantic schemas for request/response validation.
These schemas define the structure of data sent to and from the API.
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# ============================================
# User Schemas
# ============================================

class UserBase(BaseModel):
    """Base user schema with common fields."""
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "user"


class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserResponse(UserBase):
    """Schema for user response (excludes password)."""
    id: UUID
    is_active: bool
    pid: Optional[str] = None
    identity_image_url: Optional[str] = None
    consent_pdf_url: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserWithToken(BaseModel):
    """Schema for login response with token."""
    user: UserResponse
    token: str


# ============================================
# Project Schemas
# ============================================

class ProjectBase(BaseModel):
    """Base project schema with common fields."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    notes: Optional[str] = None
    target_image_count: int = Field(default=0, ge=0)
    status: str = Field(default="active")
    camera_dslr: bool = False
    camera_mobile: bool = False
    pii_face: bool = False
    pii_objects: bool = False
    pii_document: bool = False
    pii_other: bool = False


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""
    owner_id: Optional[UUID] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    notes: Optional[str] = None
    target_image_count: Optional[int] = Field(None, ge=0)
    status: Optional[str] = None
    camera_dslr: Optional[bool] = None
    camera_mobile: Optional[bool] = None
    pii_face: Optional[bool] = None
    pii_objects: Optional[bool] = None
    pii_document: Optional[bool] = None
    pii_other: Optional[bool] = None


class ProjectResponse(ProjectBase):
    """Schema for project response."""
    id: UUID
    owner_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    """Schema for paginated project list."""
    projects: List[ProjectResponse]
    pagination: Dict[str, int]


# ============================================
# Person Schemas
# ============================================

class PersonBase(BaseModel):
    """Base person schema with common fields."""
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    consent_status: str = "pending"
    notes: Optional[str] = None


class PersonCreate(PersonBase):
    """Schema for creating a new person."""
    consent_date: Optional[datetime] = None


class PersonUpdate(BaseModel):
    """Schema for updating a person (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    consent_status: Optional[str] = None
    consent_date: Optional[datetime] = None
    notes: Optional[str] = None


class PersonResponse(PersonBase):
    """Schema for person response."""
    id: UUID
    project_id: UUID
    user_id: Optional[UUID] = None
    consent_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Image Schemas
# ============================================

class ImageBase(BaseModel):
    """Base image schema with common fields."""
    name: str
    factor: Optional[str] = None
    batch_number: Optional[str] = None
    camera_type: Optional[str] = None


class ImageCreate(ImageBase):
    """Schema for creating a new image."""
    pass


class ImageResponse(ImageBase):
    """Schema for image response."""
    id: UUID
    project_id: UUID
    file_url: Optional[str]
    file_size: Optional[int]
    mime_type: Optional[str]
    width: Optional[int]
    height: Optional[int]
    image_metadata: Optional[Dict[str, Any]]  # Changed from metadata to image_metadata
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Consent Form Schemas
# ============================================

class ConsentFormBase(BaseModel):
    """Base consent form schema with common fields."""
    form_name: str
    signed_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class ConsentFormCreate(ConsentFormBase):
    """Schema for creating a new consent form."""
    person_id: UUID


class ConsentFormUpdate(BaseModel):
    """Schema for updating a consent form."""
    is_matched: Optional[bool] = None
    signed_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class ConsentFormResponse(ConsentFormBase):
    """Schema for consent form response."""
    id: UUID
    project_id: UUID
    person_id: Optional[UUID]
    file_url: Optional[str]
    file_size: Optional[int]
    mime_type: Optional[str]
    is_matched: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Event Schemas
# ============================================

class EventResponse(BaseModel):
    """Schema for event response."""
    id: UUID
    project_id: UUID
    user_id: Optional[UUID]
    event_type: str
    description: Optional[str]
    event_metadata: Optional[Dict[str, Any]]  # Changed from metadata to event_metadata
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Statistics Schemas
# ============================================

class ProjectStats(BaseModel):
    """Schema for project statistics."""
    total_images: int
    total_persons: int
    total_consent_forms: int
    consent_granted: int
    consent_pending: int
    consent_denied: int
    images_by_camera: Dict[str, int]
    images_by_batch: Dict[str, int]


# ============================================
# Generic Response Schemas
# ============================================

class MessageResponse(BaseModel):
    """Generic message response."""
    message: str


class ErrorResponse(BaseModel):
    """Error response schema."""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None


# ============================================
# Enrollment Status Schemas
# ============================================

class EnrollmentStatusResponse(BaseModel):
    """Schema for enrollment and consent status of a user in a project."""
    user_id: UUID
    user_name: str
    user_email: str
    pid: Optional[str] = None
    is_detected: bool  # Whether face was detected in project images
    consent_status: str  # "matching", "not_matching", "pending"
    match_confidence: Optional[int] = None  # 0-100 if detected
    person_id: Optional[UUID] = None  # Person record ID if detected
    has_identity_image: bool
    has_consent_pdf: bool

