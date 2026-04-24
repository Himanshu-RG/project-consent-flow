"""
Image endpoints for uploading and managing images (no authentication).
Handles image file uploads, listing, and deletion.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID, uuid4
import os
import shutil
from pathlib import Path
from PIL import Image as PILImage
from app.db.database import get_db
from app.models.models import Image, Project, Event
from app.schemas.schemas import ImageResponse
from app.core.config import settings


router = APIRouter(tags=["Images"])


@router.post("/projects/{project_id}/images", response_model=List[ImageResponse], status_code=status.HTTP_201_CREATED)
async def upload_images(
    project_id: UUID,
    files: List[UploadFile] = File(...),
    factor: Optional[str] = Form(None),
    batch_number: Optional[str] = Form(None),
    camera_type: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload one or more images to a project.
    
    - **files**: Image files to upload (JPEG, PNG, GIF, BMP)
    - **factor**: Image factor (Individual, Group, etc.)
    - **batch_number**: Batch identifier
    - **camera_type**: Camera type (dslr, mobile, other)
    
    Returns list of uploaded images with metadata.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Create upload directory for this project
    upload_dir = Path(settings.IMAGES_DIR) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    uploaded_images = []
    
    for file in files:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} is not an image"
            )
        
        # Validate file extension
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in settings.ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_extension} not allowed. Allowed types: {', '.join(settings.ALLOWED_IMAGE_EXTENSIONS)}"
            )
        
        # Generate unique filename
        unique_filename = f"{uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get image dimensions and normalize EXIF orientation
        try:
            with PILImage.open(file_path) as img:
                from PIL import ImageOps
                # Strip EXIF orientation and ensure it is physically upright
                img = ImageOps.exif_transpose(img)
                # Overwrite the original file with the EXIF-stripped upright version
                img.save(file_path, quality=100)
                width, height = img.size
        except Exception as e:
            print(f"Error checking/rotating EXIF: {e}")
            width, height = None, None
        
        # Get file size
        file_size = file_path.stat().st_size
        
        # Validate file size
        if file_size > settings.MAX_FILE_SIZE:
            os.remove(file_path)  # Delete the file
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds maximum size of {settings.MAX_FILE_SIZE / (1024*1024)}MB"
            )
        
        # Create image record
        new_image = Image(
            project_id=project_id,
            name=file.filename,
            file_path=str(file_path),
            file_url=f"/uploads/images/{project_id}/{unique_filename}",
            file_size=file_size,
            mime_type=file.content_type,
            width=width,
            height=height,
            factor=factor,
            batch_number=batch_number,
            camera_type=camera_type
        )
        
        db.add(new_image)
        uploaded_images.append(new_image)
    
    db.commit()
    
    # Refresh all images to get generated IDs
    for img in uploaded_images:
        db.refresh(img)
    
    # Log event
    event = Event(
        project_id=project_id,
        event_type="images_uploaded",
        description=f"{len(uploaded_images)} image(s) uploaded",
        event_metadata={"count": len(uploaded_images), "batch_number": batch_number}
    )
    db.add(event)
    db.commit()
    
    return uploaded_images


@router.get("/projects/{project_id}/images", response_model=List[ImageResponse])
async def list_images(
    project_id: UUID,
    batch_number: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all images in a project.
    
    Query parameters:
    - **batch_number**: Filter by batch number (optional)
    
    Returns list of images in the project.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Build query
    query = db.query(Image).filter(Image.project_id == project_id)
    
    # Apply batch filter if provided
    if batch_number:
        query = query.filter(Image.batch_number == batch_number)
    
    images = query.order_by(Image.created_at.desc()).all()
    
    return images


@router.get("/images/{image_id}", response_model=ImageResponse)
async def get_image(
    image_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get a specific image by ID.
    
    Returns detailed image information.
    """
    image = db.query(Image).filter(Image.id == image_id).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    
    return image


@router.delete("/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete an image.
    
    This will also delete the physical file from disk.
    Returns 204 No Content on success.
    """
    # Find image
    image = db.query(Image).filter(Image.id == image_id).first()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found"
        )
    
    project_id = image.project_id
    
    # Delete physical file
    if image.file_path and os.path.exists(image.file_path):
        try:
            os.remove(image.file_path)
        except Exception as e:
            print(f"Error deleting file: {e}")
    
    # Delete database record
    db.delete(image)
    db.commit()
    
    # Log event
    event = Event(
        project_id=project_id,
        event_type="image_deleted",
        description=f"Image '{image.name}' deleted",
        event_metadata={"image_name": image.name}
    )
    db.add(event)
    db.commit()
    
    return None
