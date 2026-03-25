# PostgreSQL Database Setup

## Overview
This project uses PostgreSQL 15 running in Docker on port **5433** (to avoid conflicts with default PostgreSQL installations).

## Quick Start

### 1. Prerequisites
- Docker and Docker Compose installed
- Port 5433 available on your machine

### 2. Start the Database

```bash
# Start PostgreSQL container
docker-compose up -d

# Check if database is running
docker-compose ps
```

### 3. Verify Connection

```bash
# Connect to database using psql
docker exec -it consentmap_postgres psql -U consentmap_user -d consentmap_db

# Or use any PostgreSQL client with these credentials:
# Host: localhost
# Port: 5433
# Database: consentmap_db
# Username: consentmap_user
# Password: consentmap_pass
```

## Database Schema

### Tables Created

1. **users** - Application users (admin, user, viewer roles)
2. **projects** - Main projects with camera/PII settings
3. **persons** - Participants/subjects in projects
4. **consent_forms** - Consent form documents
5. **images** - Individual images with metadata
6. **group_images** - Group photos
7. **image_person** - Many-to-many mapping between images and persons
8. **data_entries** - Data processing tracking
9. **events** - Timeline/audit log

### Key Features

- ✅ UUID primary keys
- ✅ Foreign key relationships with CASCADE deletes
- ✅ Automatic `updated_at` timestamp triggers
- ✅ Indexes for performance optimization
- ✅ JSONB fields for flexible metadata storage
- ✅ Check constraints for data validation
- ✅ Default seed data (admin and user accounts)
- ✅ Timezone set to Asia/Kolkata

## Connection String

```
postgresql://consentmap_user:consentmap_pass@localhost:5433/consentmap_db
```

## Useful Commands

### Docker Management

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# Stop and remove all data (CAUTION!)
docker-compose down -v

# View logs
docker-compose logs -f postgres

# Restart database
docker-compose restart
```

### Database Operations

```bash
# Access PostgreSQL shell
docker exec -it consent-map-db psql -U consentmap -d consentmap_db

# Backup database
docker exec consent-map-db pg_dump -U consentmap consentmap_db > backup.sql

# Restore database
docker exec -i consent-map-db psql -U consentmap -d consentmap_db < backup.sql

# Run SQL file
docker exec -i consent-map-db psql -U consentmap -d consentmap_db < database/init/01-schema.sql
```

### Useful SQL Queries

```sql
-- List all tables
\dt

-- Describe a table
\d projects

-- Count records in each table
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'persons', COUNT(*) FROM persons;

-- View all projects
SELECT id, name, status, created_at FROM projects ORDER BY created_at DESC;
```

## Schema Modifications

The schema is automatically applied when the container starts for the first time. To modify:

1. Edit `database/init/01-schema.sql`
2. Remove the existing container and volume:
   ```bash
   docker-compose down -v
   ```
3. Start fresh:
   ```bash
   docker-compose up -d
   ```

## Default Credentials

### Database
- **Username**: consentmap
- **Password**: consentmap_dev_password
- **Database**: consentmap_db
- **Port**: 5433

### Application Users (Seed Data)
- **Admin**: admin@consentmap.com (password needs to be set with proper bcrypt hash)
- **User**: user@consentmap.com (password needs to be set with proper bcrypt hash)

⚠️ **Important**: Update passwords in production!

## Next Steps

1. ✅ Database is ready
2. ⏳ Build REST APIs for CRUD operations
3. ⏳ Connect frontend to backend APIs
4. ⏳ Implement authentication
5. ⏳ Add file upload functionality

## Troubleshooting

### Port Already in Use
If port 5433 is already in use, edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "5434:5432"  # Use 5434 instead
```

### Container Won't Start
```bash
# Check logs
docker-compose logs postgres

# Remove and recreate
docker-compose down -v
docker-compose up -d
```

### Can't Connect
1. Ensure Docker is running
2. Check if container is up: `docker-compose ps`
3. Verify port is correct: `5433`
4. Check firewall settings
