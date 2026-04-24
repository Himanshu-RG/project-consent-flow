"""
SQLAlchemy database models matching the PostgreSQL schema.
These models represent the database tables and relationships.

Architecture v2: Fixed admin/user accounts, dataset-based face recognition.
- No user enrollment per project
- persons table stores ML-detected individuals (name + pid from dataset, bbox, confidence)
- consent_forms stored per project (uploaded at project creation)
"""

from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


class KnownPerson(Base):
    """Reference table for persons in the known dataset.
    
    Populated at server startup from the dataset_known folder.
    Each record represents one lab member whose face images are in the dataset.
    Used during project processing to look up a name/pid once the ML model
    returns a match.
    """
    __tablename__ = "known_persons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pid = Column(String(255), unique=True, nullable=False, index=True)  # "Arun.A"
    name = Column(String(255), nullable=False)                           # "Arun.A"
    image_path = Column(Text)                                           # absolute path to dataset image
    embedding = Column(JSONB)                                           # float list
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class User(Base):
    """User model for authentication and authorization.
    
    Only admin and user roles. No face/identity/consent PDF fields.
    """
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50), default="user")  # 'admin' or 'user'
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    projects = relationship("Project", back_populates="owner")
    events = relationship("Event", back_populates="user")
    
    from sqlalchemy import CheckConstraint
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'user')", name="check_user_role"),
    )


class Project(Base):
    """Project model for managing consent mapping projects."""
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    notes = Column(Text)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    target_image_count = Column(Integer, default=0)
    status = Column(String(50), default="active")
    camera_dslr = Column(Boolean, default=False)
    camera_mobile = Column(Boolean, default=False)
    pii_face = Column(Boolean, default=False)
    pii_objects = Column(Boolean, default=False)
    pii_document = Column(Boolean, default=False)
    pii_other = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="projects")
    persons = relationship("Person", back_populates="project", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")
    consent_forms = relationship("ConsentForm", back_populates="project", cascade="all, delete-orphan")
    group_images = relationship("GroupImage", back_populates="project", cascade="all, delete-orphan")
    data_entries = relationship("DataEntry", back_populates="project", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="project", cascade="all, delete-orphan")
    
    from sqlalchemy import CheckConstraint
    __table_args__ = (
        CheckConstraint("status IN ('active', 'completed', 'on-hold', 'archived')", name="check_project_status"),
    )


class Person(Base):
    """Person model for ML-detected individuals in project images.
    
    Populated by the ML pipeline after processing project images.
    Each record represents a detected face matched against the known dataset.
    - pid: person identifier (from dataset, e.g. 'Arun.A')
    - name: person's full name from dataset
    - bbox: bounding box from last detected occurrence (JSONB: {x, y, width, height})
    - confidence: match confidence score (0.0 - 1.0)
    - consent_status: whether consent PDF was found for this person in the project
    """
    __tablename__ = "persons"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    pid = Column(String(100))          # Person identifier from dataset (e.g. 'Arun.A')
    confidence = Column(Float)         # ML match confidence (0.0 - 1.0)
    bbox = Column(JSONB)               # Bounding box: {x, y, width, height}
    embedding = Column(JSONB)          # FaceNet embedding vector for this person
    consent_status = Column(String(50), default="pending")
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="persons")
    consent_forms = relationship("ConsentForm", back_populates="person", cascade="all, delete-orphan")
    image_associations = relationship("ImagePerson", back_populates="person", cascade="all, delete-orphan")
    data_entries = relationship("DataEntry", back_populates="person")
    
    from sqlalchemy import CheckConstraint
    __table_args__ = (
        CheckConstraint("consent_status IN ('pending', 'granted', 'denied', 'expired')", name="check_consent_status"),
    )


class ConsentForm(Base):
    """Consent form model for storing consent documents.
    
    Uploaded during project creation or via the project consent endpoint.
    Can optionally be linked to a detected Person record.
    """
    __tablename__ = "consent_forms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="SET NULL"), nullable=True)
    form_name = Column(String(255), nullable=False)
    file_url = Column(Text)
    file_path = Column(Text)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    is_matched = Column(Boolean, default=False)
    signed_date = Column(TIMESTAMP)
    expiry_date = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="consent_forms")
    person = relationship("Person", back_populates="consent_forms")


class Image(Base):
    """Image model for storing uploaded images."""
    __tablename__ = "images"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    file_url = Column(Text)
    file_path = Column(Text)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    width = Column(Integer)
    height = Column(Integer)
    factor = Column(String(100))
    batch_number = Column(String(100))
    camera_type = Column(String(50))
    image_metadata = Column("metadata", JSONB)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="images")
    person_associations = relationship("ImagePerson", back_populates="image", cascade="all, delete-orphan")
    group_images = relationship("GroupImage", back_populates="image")
    data_entries = relationship("DataEntry", back_populates="image")
    
    from sqlalchemy import CheckConstraint
    __table_args__ = (
        CheckConstraint("camera_type IN ('dslr', 'mobile', 'other')", name="check_camera_type"),
    )


class GroupImage(Base):
    """Group image model for managing group photos."""
    __tablename__ = "group_images"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    participant_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="group_images")
    image = relationship("Image", back_populates="group_images")


class ImagePerson(Base):
    """Junction table for many-to-many relationship between images and persons.

    bbox and confidence are stored here (per detection) rather than on Person,
    because the same person appears at a different position in every image.
    """
    __tablename__ = "image_person"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    is_primary = Column(Boolean, default=False)
    bbox = Column(JSONB)       # {x, y, width, height} — face position IN THIS image
    confidence = Column(Float) # ML match confidence for THIS detection
    consent_pid = Column(String(255))  # best-match known-person pid (may be below identity threshold)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    image = relationship("Image", back_populates="person_associations")
    person = relationship("Person", back_populates="image_associations")


class DataEntry(Base):
    """Data entry model for tracking data processing."""
    __tablename__ = "data_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"))
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"))
    entry_type = Column(String(50), default="manual")
    status = Column(String(50), default="pending")
    entry_data = Column("data", JSONB)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="data_entries")
    person = relationship("Person", back_populates="data_entries")
    image = relationship("Image", back_populates="data_entries")
    
    from sqlalchemy import CheckConstraint
    __table_args__ = (
        CheckConstraint("entry_type IN ('manual', 'automated', 'verified')", name="check_entry_type"),
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed')", name="check_entry_status"),
    )


class Event(Base):
    """Event model for audit logging and timeline."""
    __tablename__ = "events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    event_type = Column(String(100), nullable=False)
    description = Column(Text)
    event_metadata = Column("metadata", JSONB)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="events")
    user = relationship("User", back_populates="events")
