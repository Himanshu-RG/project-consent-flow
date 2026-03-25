
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
import uuid
from app.db.database import get_db
from app.core.config import settings
from app.api.dependencies import get_current_user
from app.models.models import User
from app.schemas.schemas import UserResponse, MessageResponse
from app.ml.face_recognition import ml_service

router = APIRouter()

@router.get("", response_model=List[UserResponse])
async def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all users (for enrollment selection).
    Requires authentication.
    """
    users = db.query(User).filter(User.is_active == True).all()
    return users

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user profile.
    """
    return current_user

@router.post("/me/identity", response_model=UserResponse)
async def upload_identity(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload user identity image, detect face, and generate embedding.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # Read file content
    content = await file.read()
    
    # Detect faces
    crops = ml_service.detect_and_crop(content)
    
    if not crops:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in the image"
        )
    
    if len(crops) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multiple faces detected. Please upload an image with a single face."
        )
    
    # Generate embedding
    embedding = ml_service.get_embedding(crops[0])
    
    # Generate PID if user doesn't have one
    if not current_user.pid:
        import time
        # Generate unique PID: PID-{timestamp}-{short_uuid}
        timestamp = int(time.time())
        short_uuid = str(uuid.uuid4())[:8]
        current_user.pid = f"PID-{timestamp}-{short_uuid}"
    
    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{current_user.id}_{uuid.uuid4()}{file_ext}"
    identity_dir = settings.IDENTITY_DIR
    os.makedirs(identity_dir, exist_ok=True)
    file_path = os.path.join(identity_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(content)
        
    # Update user record
    # Construct URL (assuming static file serving is set up for 'uploads')
    # Use relative path from backend root, accessible via static mount
    file_url = f"/api/static/identity/{filename}"
    
    current_user.identity_image_url = file_url
    current_user.face_embedding = embedding
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.post("/me/consent", response_model=UserResponse)
async def upload_consent(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload user consent PDF (global).
    """
    if not file.content_type == "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF"
        )
    
    content = await file.read()
    
    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{current_user.id}_{uuid.uuid4()}{file_ext}"
    consent_dir = settings.USER_CONSENT_DIR
    os.makedirs(consent_dir, exist_ok=True)
    file_path = os.path.join(consent_dir, filename)
    
    with open(file_path, "wb") as f:
        f.write(content)
        
    file_url = f"/api/static/user_consent/{filename}"
    
    current_user.consent_pdf_url = file_url
    current_user.consent_pdf_path = file_path
    
    db.commit()
    db.refresh(current_user)
    
    return current_user
