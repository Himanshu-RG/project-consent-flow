# ConsentMap FastAPI Backend

A comprehensive REST API backend for the ConsentMap application, built with FastAPI and PostgreSQL.

## Features

- ✅ **Authentication**: JWT-based authentication with bcrypt password hashing
- ✅ **Project Management**: Full CRUD operations for projects
- ✅ **Person Management**: Manage participants/subjects with consent tracking
- ✅ **Image Upload**: Multi-file upload with metadata extraction
- ✅ **Consent Forms**: PDF upload and management
- ✅ **Event Logging**: Audit trail for all actions
- ✅ **File Storage**: Local file system storage for images and PDFs
- ✅ **CORS Support**: Configured for frontend integration
- ✅ **API Documentation**: Auto-generated Swagger/ReDoc documentation

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py          # Authentication endpoints
│   │   │   │   ├── projects.py      # Project CRUD
│   │   │   │   ├── persons.py       # Person CRUD
│   │   │   │   ├── images.py        # Image upload/management
│   │   │   │   └── consent.py       # Consent form management
│   │   │   └── api.py               # API router
│   │   └── dependencies.py          # Auth dependencies
│   ├── core/
│   │   ├── config.py                # Configuration settings
│   │   └── security.py              # JWT & password utilities
│   ├── db/
│   │   └── database.py              # Database connection
│   ├── models/
│   │   └── models.py                # SQLAlchemy models
│   ├── schemas/
│   │   └── schemas.py               # Pydantic schemas
│   └── main.py                      # FastAPI application
├── uploads/                         # File storage
│   ├── images/                      # Uploaded images
│   └── consent_pdfs/                # Uploaded consent PDFs
├── requirements.txt                 # Python dependencies
├── .env.example                     # Environment template
└── README.md                        # This file
```

## Quick Start

### 1. Prerequisites

- Python 3.9+
- PostgreSQL database running (see main project's docker-compose.yml)
- Virtual environment (recommended)

### 2. Installation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configuration

```bash
# Copy environment template
copy .env.example .env

# Edit .env file with your settings
# Make sure DATABASE_URL matches your PostgreSQL connection
```

### 4. Run the Server

```bash
# Development mode with auto-reload
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use the main.py directly
python app/main.py
```

The API will be available at:
- **API Base**: http://localhost:8000/api
- **Swagger Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects (with pagination)
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### Persons
- `POST /api/projects/{id}/persons` - Add person to project
- `GET /api/projects/{id}/persons` - List persons in project
- `PUT /api/persons/{id}` - Update person
- `DELETE /api/persons/{id}` - Delete person

### Images
- `POST /api/projects/{id}/images` - Upload images
- `GET /api/projects/{id}/images` - List images in project
- `GET /api/images/{id}` - Get image details
- `DELETE /api/images/{id}` - Delete image

### Consent Forms
- `POST /api/projects/{id}/consent` - Upload consent form
- `GET /api/projects/{id}/consent` - List consent forms
- `PUT /api/consent/{id}` - Update consent form
- `DELETE /api/consent/{id}` - Delete consent form

## Authentication

All endpoints (except `/auth/register` and `/auth/login`) require authentication.

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://consentmap_user:consentmap_pass@localhost:5433/consentmap_db` |
| `SECRET_KEY` | JWT secret key | (change in production!) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration time | `30` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:3000,http://localhost:5173` |
| `MAX_UPLOAD_SIZE` | Max file upload size (bytes) | `10485760` (10MB) |
| `DEBUG` | Debug mode | `True` |

## Database Models

The API uses the following database models:

- **User**: Authentication and user management
- **Project**: Main project entity
- **Person**: Participants/subjects in projects
- **ConsentForm**: Consent documents
- **Image**: Uploaded images
- **GroupImage**: Group photo metadata
- **ImagePerson**: Image-Person associations
- **DataEntry**: Data processing tracking
- **Event**: Audit log/timeline

## Development

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

### Code Formatting
```bash
# Install formatting tools
pip install black isort

# Format code
black app/
isort app/
```

## Production Deployment

1. **Set strong SECRET_KEY** in environment variables
2. **Disable DEBUG mode**: Set `DEBUG=False`
3. **Use production database**: Update `DATABASE_URL`
4. **Configure CORS**: Set appropriate `ALLOWED_ORIGINS`
5. **Use HTTPS**: Deploy behind reverse proxy (nginx)
6. **Set up file storage**: Consider cloud storage (S3, etc.)

### Example with Gunicorn
```bash
pip install gunicorn
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env file
- Verify database credentials

### Import Errors
- Ensure virtual environment is activated
- Install all dependencies: `pip install -r requirements.txt`

### File Upload Errors
- Check upload directory permissions
- Verify MAX_UPLOAD_SIZE setting
- Ensure sufficient disk space

## API Documentation

Visit `/docs` for interactive Swagger documentation where you can:
- View all endpoints
- Test API calls directly
- See request/response schemas
- Authenticate and try protected endpoints

## License

MIT License - See main project LICENSE file

## Support

For issues and questions, please refer to the main project repository.
