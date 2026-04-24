"""
API v1 router that combines all endpoint routers.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import auth, projects, persons, images, consent, users


# Create main API v1 router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router)
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(projects.router)   # Already has /projects prefix
api_router.include_router(persons.router)
api_router.include_router(images.router)
api_router.include_router(consent.router)    # Has full paths in endpoints
