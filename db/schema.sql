-- ConsentMap Database Schema
-- PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    notes TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_image_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'archived')),
    camera_dslr BOOLEAN DEFAULT FALSE,
    camera_mobile BOOLEAN DEFAULT FALSE,
    pii_face BOOLEAN DEFAULT FALSE,
    pii_objects BOOLEAN DEFAULT FALSE,
    pii_document BOOLEAN DEFAULT FALSE,
    pii_other BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PERSONS TABLE (Participants/Subjects)
-- ============================================
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    consent_status VARCHAR(50) DEFAULT 'pending' CHECK (consent_status IN ('pending', 'granted', 'denied', 'expired')),
    consent_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CONSENT FORMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS consent_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    form_name VARCHAR(255) NOT NULL,
    file_url TEXT,
    file_path TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    is_matched BOOLEAN DEFAULT FALSE,
    signed_date TIMESTAMP,
    expiry_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_url TEXT,
    file_path TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    width INT,
    height INT,
    factor VARCHAR(100),  -- e.g., "Individual", "Group", etc.
    batch_number VARCHAR(100),
    camera_type VARCHAR(50) CHECK (camera_type IN ('dslr', 'mobile', 'other')),
    metadata JSONB,  -- Store additional metadata as JSON
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- GROUP IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS group_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    participant_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- IMAGE_PERSON MAPPING TABLE (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS image_person (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,  -- Is this the primary subject in the image
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(image_id, person_id)
);

-- ============================================
-- DATA ENTRIES TABLE (For tracking data processing)
-- ============================================
CREATE TABLE IF NOT EXISTS data_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    entry_type VARCHAR(50) DEFAULT 'manual' CHECK (entry_type IN ('manual', 'automated', 'verified')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    data JSONB,  -- Flexible data storage
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- EVENTS/TIMELINE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,  -- e.g., 'project_created', 'image_uploaded', 'consent_added'
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES for Performance
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Persons indexes
CREATE INDEX IF NOT EXISTS idx_persons_project ON persons(project_id);
CREATE INDEX IF NOT EXISTS idx_persons_consent_status ON persons(consent_status);

-- Consent forms indexes
CREATE INDEX IF NOT EXISTS idx_consent_project ON consent_forms(project_id);
CREATE INDEX IF NOT EXISTS idx_consent_person ON consent_forms(person_id);

-- Images indexes
CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_images_batch ON images(batch_number);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);

-- Group images indexes
CREATE INDEX IF NOT EXISTS idx_group_images_project ON group_images(project_id);
CREATE INDEX IF NOT EXISTS idx_group_images_image ON group_images(image_id);

-- Image-Person mapping indexes
CREATE INDEX IF NOT EXISTS idx_image_person_image ON image_person(image_id);
CREATE INDEX IF NOT EXISTS idx_image_person_person ON image_person(person_id);

-- Data entries indexes
CREATE INDEX IF NOT EXISTS idx_data_entries_project ON data_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_data_entries_status ON data_entries(status);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- ============================================
-- TRIGGERS for updated_at timestamps
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_persons_updated_at BEFORE UPDATE ON persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consent_forms_updated_at BEFORE UPDATE ON consent_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_images_updated_at BEFORE UPDATE ON group_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_entries_updated_at BEFORE UPDATE ON data_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA (Development Only)
-- ============================================

-- Insert default admin user (password: admin123)
-- Note: In production, use proper password hashing
INSERT INTO users (email, password_hash, full_name, role) 
VALUES (
    'admin@consentmap.com',
    '$2b$10$rKJ5VGXqVqX5vqX5vqX5vOqX5vqX5vqX5vqX5vqX5vqX5vqX5vqX5',  -- This is a placeholder, replace with actual bcrypt hash
    'Admin User',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample user
INSERT INTO users (email, password_hash, full_name, role) 
VALUES (
    'user@consentmap.com',
    '$2b$10$rKJ5VGXqVqX5vqX5vqX5vOqX5vqX5vqX5vqX5vqX5vqX5vqX5vqX5',  -- This is a placeholder
    'Regular User',
    'user'
) ON CONFLICT (email) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'ConsentMap database schema created successfully!';
    RAISE NOTICE 'Database is ready for use.';
END $$;
