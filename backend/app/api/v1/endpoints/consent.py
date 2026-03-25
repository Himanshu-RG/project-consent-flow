"""
Consent form endpoints for managing consent documents (no authentication).
Handles PDF upload, listing, and management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime
import os
import shutil
from pathlib import Path
from app.db.database import get_db
from app.models.models import ConsentForm, Project, Person, Event
from app.schemas.schemas import ConsentFormResponse, ConsentFormUpdate
from app.core.config import settings


router = APIRouter(tags=["Consent Forms"])


@router.post("/projects/{project_id}/consent", response_model=List[ConsentFormResponse], status_code=status.HTTP_201_CREATED)
async def upload_consent_forms(
    project_id: UUID,
    files: List[UploadFile] = File(...),
    person_id: Optional[UUID] = Form(None),
    form_name: str = Form("Consent Form"),
    signed_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload one or more consent form PDFs for a project.
    
    - **files**: PDF files to upload
    - **person_id**: ID of the person this consent is for (optional)
    - **form_name**: Name/title of the consent form
    - **signed_date**: Date the consent was signed (ISO format)
    - **expiry_date**: Date the consent expires (ISO format)
    
    Returns list of created consent form records.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Verify person exists if provided
    if person_id:
        person = db.query(Person).filter(
            Person.id == person_id,
            Person.project_id == project_id
        ).first()
        if not person:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Person not found in this project"
            )
    
    # Create upload directory for this project
    upload_dir = Path(settings.CONSENT_PDFS_DIR) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Parse dates
    signed_dt = datetime.fromisoformat(signed_date) if signed_date else None
    expiry_dt = datetime.fromisoformat(expiry_date) if expiry_date else None
    
    uploaded_consents = []
    
    for file in files:
        # Validate file type
        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} is not a PDF. Only PDF files are allowed for consent forms"
            )
        
        # Validate file extension
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in settings.ALLOWED_PDF_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_extension} not allowed. Only PDF files are allowed"
            )
        
        # Generate unique filename
        unique_filename = f"{uuid4()}{file_extension}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size = file_path.stat().st_size
        
        # Validate file size
        if file_size > settings.MAX_FILE_SIZE:
            os.remove(file_path)  # Delete the file
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds maximum size of {settings.MAX_FILE_SIZE / (1024*1024)}MB"
            )
        
        # Create consent form record
        new_consent = ConsentForm(
            project_id=project_id,
            person_id=person_id,
            form_name=form_name,
            file_path=str(file_path),
            file_url=f"/uploads/consent_pdfs/{project_id}/{unique_filename}",
            file_size=file_size,
            mime_type=file.content_type,
            signed_date=signed_dt,
            expiry_date=expiry_dt
        )
        
        db.add(new_consent)
        uploaded_consents.append(new_consent)
    
    db.commit()
    
    # Refresh all consents to get generated IDs
    for consent in uploaded_consents:
        db.refresh(consent)
    
    # Log event
    event = Event(
        project_id=project_id,
        event_type="consent_uploaded",
        description=f"{len(uploaded_consents)} consent form(s) uploaded",
        event_metadata={"count": len(uploaded_consents), "form_name": form_name}
    )
    db.add(event)
    db.commit()
    
    return uploaded_consents


@router.get("/projects/{project_id}/consent", response_model=List[ConsentFormResponse])
async def list_consent_forms(
    project_id: UUID,
    db: Session = Depends(get_db)
):
    """
    List all consent forms in a project.
    
    Returns list of all consent forms in the specified project.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Get all consent forms in project
    consent_forms = db.query(ConsentForm).filter(
        ConsentForm.project_id == project_id
    ).order_by(ConsentForm.created_at.desc()).all()
    
    return consent_forms


@router.put("/consent/{consent_id}", response_model=ConsentFormResponse)
async def update_consent_form(
    consent_id: UUID,
    consent_data: ConsentFormUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a consent form's metadata.
    
    - **is_matched**: Whether the consent is matched to images
    - **signed_date**: Update signed date
    - **expiry_date**: Update expiry date
    
    Returns the updated consent form.
    """
    # Find consent form
    consent = db.query(ConsentForm).filter(ConsentForm.id == consent_id).first()
    
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent form not found"
        )
    
    # Update only provided fields
    update_data = consent_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(consent, field, value)
    
    db.commit()
    db.refresh(consent)
    
    return consent


@router.delete("/consent/{consent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_consent_form(
    consent_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a consent form.
    
    This will also delete the physical PDF file from disk.
    Returns 204 No Content on success.
    """
    # Find consent form
    consent = db.query(ConsentForm).filter(ConsentForm.id == consent_id).first()
    
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consent form not found"
        )
    
    project_id = consent.project_id
    
    # Delete physical file
    if consent.file_path and os.path.exists(consent.file_path):
        try:
            os.remove(consent.file_path)
        except Exception as e:
            print(f"Error deleting file: {e}")
    
    # Delete database record
    db.delete(consent)
    db.commit()
    
    # Log event
    event = Event(
        project_id=project_id,
        event_type="consent_deleted",
        description=f"Consent form '{consent.form_name}' deleted",
        event_metadata={"form_name": consent.form_name}
    )
    db.add(event)
    db.commit()
    
    return None


@router.post("/projects/{project_id}/persons/{person_id}/consent", response_model=ConsentFormResponse, status_code=status.HTTP_201_CREATED)
async def upload_person_consent(
    project_id: UUID,
    person_id: UUID,
    file: UploadFile = File(...),
    form_name: str = Form("Direct Consent Upload"),
    signed_date: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload consent PDF directly for a specific person.
    This is used when a person was detected but hasn't provided consent.
    
    - **file**: PDF file to upload
    - **form_name**: Name/title of the consent form
    - **signed_date**: Date the consent was signed (ISO format)
    - **expiry_date**: Date the consent expires (ISO format)
    
    Returns the created consent form record and updates person's consent status.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Verify person exists in this project
    person = db.query(Person).filter(
        Person.id == person_id,
        Person.project_id == project_id
    ).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found in this project"
        )
    
    # Validate file type
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF"
        )
    
    # Validate file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in settings.ALLOWED_PDF_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file_extension} not allowed. Only PDF files are allowed"
        )
    
    # Create upload directory for this project
    upload_dir = Path(settings.CONSENT_PDFS_DIR) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    unique_filename = f"{uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Save file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get file size
    file_size = file_path.stat().st_size
    
    # Validate file size
    if file_size > settings.MAX_FILE_SIZE:
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size of {settings.MAX_FILE_SIZE / (1024*1024)}MB"
        )
    
    # Parse dates
    signed_dt = datetime.fromisoformat(signed_date) if signed_date else None
    expiry_dt = datetime.fromisoformat(expiry_date) if expiry_date else None
    
    # Create consent form record
    new_consent = ConsentForm(
        project_id=project_id,
        person_id=person_id,
        form_name=form_name,
        file_path=str(file_path),
        file_url=f"/uploads/consent_pdfs/{project_id}/{unique_filename}",
        file_size=file_size,
        mime_type=file.content_type,
        signed_date=signed_dt,
        expiry_date=expiry_dt,
        is_matched=True  # Mark as matched since we're directly linking it
    )
    
    db.add(new_consent)
    
    # Update person's consent status to granted
    person.consent_status = "granted"
    person.consent_date = signed_dt or datetime.now()
    
    db.commit()
    db.refresh(new_consent)
    
    # Log event
    event = Event(
        project_id=project_id,
        event_type="consent_uploaded",
        description=f"Direct consent uploaded for {person.name}",
        event_metadata={"person_name": person.name, "person_id": str(person_id)}
    )
    db.add(event)
    db.commit()
    
    return new_consent

