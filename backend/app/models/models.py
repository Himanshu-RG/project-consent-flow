"""
SQLAlchemy database models matching the PostgreSQL schema.
These models represent the database tables and relationships.
"""

from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, ForeignKey, BigInteger, CheckConstraint, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.database import Base


# Association table for project enrollments (many-to-many)
project_enrollments = Table(
    'project_enrollments',
    Base.metadata,
    Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column('project_id', UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
    Column('enrolled_at', TIMESTAMP, server_default=func.now()),
)


class User(Base):
    """User model for authentication and authorization."""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50), default="user")
    is_active = Column(Boolean, default=True)
    pid = Column(String(50), unique=True, index=True)  # Unique person identifier
    identity_image_url = Column(Text)
    face_embedding = Column(JSONB)
    consent_pdf_url = Column(Text)
    consent_pdf_path = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    projects = relationship("Project", back_populates="owner")
    events = relationship("Event", back_populates="user")
    person_profile = relationship("Person", back_populates="user", uselist=False)
    enrolled_projects = relationship("Project", secondary=project_enrollments, back_populates="enrolled_users")
    
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'user', 'viewer')", name="check_user_role"),
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
    enrolled_users = relationship("User", secondary=project_enrollments, back_populates="enrolled_projects")
    
    __table_args__ = (
        CheckConstraint("status IN ('active', 'completed', 'on-hold', 'archived')", name="check_project_status"),
    )


class Person(Base):
    """Person model for participants/subjects in projects."""
    __tablename__ = "persons"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    consent_status = Column(String(50), default="pending")
    consent_date = Column(TIMESTAMP)
    face_embedding = Column(JSONB)
    match_confidence = Column(BigInteger)  # Similarity score (0-100) for ML matching
    notes = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="persons")
    user = relationship("User", back_populates="person_profile")
    consent_forms = relationship("ConsentForm", back_populates="person", cascade="all, delete-orphan")
    image_associations = relationship("ImagePerson", back_populates="person", cascade="all, delete-orphan")
    data_entries = relationship("DataEntry", back_populates="person")
    
    __table_args__ = (
        CheckConstraint("consent_status IN ('pending', 'granted', 'denied', 'expired')", name="check_consent_status"),
    )


class ConsentForm(Base):
    """Consent form model for storing consent documents."""
    __tablename__ = "consent_forms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    form_name = Column(String(255), nullable=False)
    file_url = Column(Text)
    file_path = Column(Text)
    file_size = Column(BigInteger)
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
    file_size = Column(BigInteger)
    mime_type = Column(String(100))
    width = Column(Integer)
    height = Column(Integer)
    factor = Column(String(100))
    batch_number = Column(String(100))
    camera_type = Column(String(50))
    image_metadata = Column("metadata", JSONB)  # Use column name 'metadata' in DB, but 'image_metadata' in Python
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="images")
    person_associations = relationship("ImagePerson", back_populates="image", cascade="all, delete-orphan")
    group_images = relationship("GroupImage", back_populates="image")
    data_entries = relationship("DataEntry", back_populates="image")
    
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
    """Junction table for many-to-many relationship between images and persons."""
    __tablename__ = "image_person"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    is_primary = Column(Boolean, default=False)
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
    entry_data = Column("data", JSONB)  # Use column name 'data' in DB, but 'entry_data' in Python
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="data_entries")
    person = relationship("Person", back_populates="data_entries")
    image = relationship("Image", back_populates="data_entries")
    
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
    event_metadata = Column("metadata", JSONB)  # Use column name 'metadata' in DB, but 'event_metadata' in Python
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="events")
    user = relationship("User", back_populates="events")
