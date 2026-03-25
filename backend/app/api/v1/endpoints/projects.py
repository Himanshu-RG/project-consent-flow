"""
Project endpoints for CRUD operations on projects (no authentication required).
Handles project creation, listing, retrieval, updating, and deletion.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.database import get_db
from app.models.models import Project, Event
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
)


router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new project.
    
    - **name**: Project name (required)
    - **description**: Project description
    - **notes**: Additional notes
    - **target_image_count**: Target number of images
    - **status**: Project status (active, completed, on-hold, archived)
    - **camera_dslr**: Whether DSLR camera is used
    - **camera_mobile**: Whether mobile camera is used
    - **pii_face**: Whether face PII is collected
    - **pii_objects**: Whether object PII is collected
    - **pii_document**: Whether document PII is collected
    - **pii_other**: Whether other PII is collected
    
    Returns the created project.
    """
    # Create new project
    new_project = Project(**project_data.model_dump())
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    # Log event
    event = Event(
        project_id=new_project.id,
        event_type="project_created",
        description=f"Project '{new_project.name}' created",
        event_metadata={"project_name": new_project.name}
    )
    db.add(event)
    db.commit()
    
    return new_project


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    status: str = Query(None, description="Filter by status"),
    db: Session = Depends(get_db)
):
    """
    List all projects with pagination.
    
    Query parameters:
    - **page**: Page number (default: 1)
    - **limit**: Items per page (default: 10, max: 100)
    - **status**: Filter by project status (optional)
    
    Returns paginated list of projects.
    """
    # Build query
    query = db.query(Project)
    
    # Apply status filter if provided
    if status:
        query = query.filter(Project.status == status)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * limit
    projects = query.order_by(Project.created_at.desc()).offset(offset).limit(limit).all()
    
    # Calculate total pages
    total_pages = (total + limit - 1) // limit
    
    return {
        "projects": projects,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages
        }
    }


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get a specific project by ID.
    
    Returns detailed project information including all related data.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a project.
    
    All fields are optional. Only provided fields will be updated.
    Returns the updated project.
    """
    # Find project
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Update only provided fields
    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    
    # Log event
    event = Event(
        project_id=project.id,
        event_type="project_updated",
        description=f"Project '{project.name}' updated",
        event_metadata={"updated_fields": list(update_data.keys())}
    )
    db.add(event)
    db.commit()
    
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a project.
    
    This will cascade delete all related data (persons, images, consent forms, etc.).
    Returns 204 No Content on success.
    """
    # Find project
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Delete project (cascade will handle related data)
    db.delete(project)
    db.commit()
    
    return None


@router.post("/{project_id}/process", status_code=status.HTTP_200_OK)
async def process_project(
    project_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Process project images: detect faces, generate embeddings, and match with users.
    """
    # Import here to avoid circular dependencies if any
    from app.models.models import User, Person, Image, ImagePerson
    from app.ml.face_recognition import ml_service
    from app.core.config import settings
    import os
    
    # Get project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get enrolled users with embeddings
    enrolled_users = [u for u in project.enrolled_users if u.face_embedding is not None]
    known_users = [
        {
            "id": str(u.id), 
            "embedding": u.face_embedding, 
            "name": u.full_name,
            "email": u.email,
            "consent_pdf_url": u.consent_pdf_url,
            "type": "user",
            "obj": u
        } 
        for u in enrolled_users
    ]

    # Get all persons in project with embeddings
    persons = db.query(Person).filter(
        Person.project_id == project_id, 
        Person.face_embedding.isnot(None)
    ).all()
    known_persons = [
        {
            "id": str(p.id), 
            "embedding": p.face_embedding, 
            "name": p.name, 
            "type": "person", 
            "obj": p
        } 
        for p in persons
    ]
    
    # Get all images in project
    images = db.query(Image).filter(Image.project_id == project_id).all()
    
    stats = {
        "processed_images": 0,
        "faces_detected": 0,
        "matched_users": 0,
        "matched_persons": 0,
        "new_persons": 0
    }
    
    for img in images:
        # Construct file path logic
        img_path = img.file_path
        if not os.path.exists(img_path):
             # Try constructing from new config logic
             filename = os.path.basename(img_path)
             img_path = os.path.join(settings.IMAGES_DIR, str(project_id), filename)
             if not os.path.exists(img_path):
                 print(f"Image not found: {img_path}")
                 continue

        try:
            with open(img_path, "rb") as f:
                content = f.read()
            
            crops = ml_service.detect_and_crop(content)
            
            if not crops:
                continue
                
            stats["processed_images"] += 1
            stats["faces_detected"] += len(crops)
            
            for crop in crops:
                embedding = ml_service.get_embedding(crop)
                
                # Match against Users
                user_match, user_score = ml_service.match_face(embedding, known_users)
                
                matched_person = None
                
                if user_match:
                    # Found a User!
                    stats["matched_users"] += 1
                    user_obj = user_match["obj"]
                    
                    # Check if Person exists for this User in this Project
                    person = db.query(Person).filter(
                        Person.project_id == project_id,
                        Person.user_id == user_obj.id
                    ).first()
                    
                    if not person:
                        # Create new Person linked to User
                        # Determine consent status based on user's consent PDF
                        consent_status = "granted" if user_obj.consent_pdf_url else "pending"
                        
                        person = Person(
                            project_id=project_id,
                            user_id=user_obj.id,
                            name=user_obj.full_name or "Unknown User",
                            email=user_obj.email,
                            face_embedding=embedding,
                            consent_status=consent_status,
                            match_confidence=int(user_score * 100)  # Store as 0-100
                        )
                        db.add(person)
                        db.commit()
                        db.refresh(person)
                        
                        # Add to known_persons for subsequent matches
                        known_persons.append({
                            "id": str(person.id),
                            "embedding": embedding,
                            "name": person.name,
                            "type": "person",
                            "obj": person
                        })
                    else:
                        # Update consent status if user uploaded consent after person was created
                        if user_obj.consent_pdf_url and person.consent_status != "granted":
                            person.consent_status = "granted"
                            db.add(person)
                            db.commit()
                            
                    matched_person = person
                    
                else:
                    # No User match, check existing Persons in this project
                    # Filter known_persons to only include those from this project (redundant check but safe)
                    project_persons = [k for k in known_persons if str(k["obj"].project_id) == str(project_id)]
                    
                    person_match, person_score = ml_service.match_face(embedding, project_persons)
                    
                    if person_match:
                        stats["matched_persons"] += 1
                        matched_person = person_match["obj"]
                    else:
                        # New Unknown Person
                        stats["new_persons"] += 1
                        new_name = f"Person {len(known_persons) + 1}"
                        person = Person(
                            project_id=project_id,
                            name=new_name,
                            face_embedding=embedding
                        )
                        db.add(person)
                        db.commit()
                        db.refresh(person)
                        
                        matched_person = person
                        known_persons.append({
                            "id": str(person.id),
                            "embedding": embedding,
                            "name": person.name,
                            "type": "person",
                            "obj": person
                        })
                
                # Link Image to Person
                if matched_person:
                    # Check if link exists
                    link = db.query(ImagePerson).filter(
                        ImagePerson.image_id == img.id,
                        ImagePerson.person_id == matched_person.id
                    ).first()
                    
                    if not link:
                        link = ImagePerson(
                            image_id=img.id,
                            person_id=matched_person.id
                        )
                        db.add(link)
                        db.commit()

        except Exception as e:
            print(f"Error processing image {img.id}: {e}")
            continue

    return stats
