"""
Person endpoints for managing participants/subjects in projects.
Handles person CRUD operations within project context.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.database import get_db
from app.models.models import User, Person, Project, Event
from app.schemas.schemas import PersonCreate, PersonUpdate, PersonResponse, MessageResponse
from app.api.dependencies import get_current_user


router = APIRouter(tags=["Persons"])


@router.post("/projects/{project_id}/persons", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    project_id: UUID,
    person_data: PersonCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new person in a project.
    
    - **name**: Person's full name (required)
    - **email**: Person's email address
    - **phone**: Person's phone number
    - **consent_status**: Consent status (pending, granted, denied, expired)
    - **consent_date**: Date consent was given
    - **notes**: Additional notes
    
    Returns the created person.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Create new person
    new_person = Person(
        **person_data.model_dump(),
        project_id=project_id
    )
    
    db.add(new_person)
    db.commit()
    db.refresh(new_person)
    
    # Log event
    event = Event(
        project_id=project_id,
        user_id=current_user.id,
        event_type="person_added",
        description=f"Person '{new_person.name}' added to project",
        event_metadata={"person_name": new_person.name}
    )
    db.add(event)
    db.commit()
    
    return new_person


@router.get("/projects/{project_id}/persons", response_model=List[PersonResponse])
async def list_persons(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all persons in a project.
    
    Returns list of all participants/subjects in the specified project.
    """
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Get all persons in project
    persons = db.query(Person).filter(Person.project_id == project_id).all()
    
    return persons


@router.put("/persons/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: UUID,
    person_data: PersonUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a person's information.
    
    All fields are optional. Only provided fields will be updated.
    Returns the updated person.
    """
    # Find person
    person = db.query(Person).filter(Person.id == person_id).first()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    # Update only provided fields
    update_data = person_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(person, field, value)
    
    db.commit()
    db.refresh(person)
    
    # Log event
    event = Event(
        project_id=person.project_id,
        user_id=current_user.id,
        event_type="person_updated",
        description=f"Person '{person.name}' updated",
        event_metadata={"person_name": person.name}
    )
    db.add(event)
    db.commit()
    
    return person


@router.delete("/persons/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(
    person_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a person.
    
    This will cascade delete all related data (consent forms, image associations).
    Returns 204 No Content on success.
    """
    # Find person
    person = db.query(Person).filter(Person.id == person_id).first()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    project_id = person.project_id
    person_name = person.name
    
    # Delete person
    db.delete(person)
    db.commit()
    
    # Log event
    event = Event(
        project_id=project_id,
        user_id=current_user.id,
        event_type="person_deleted",
        description=f"Person '{person_name}' deleted",
        event_metadata={"person_name": person_name}
    )
    db.add(event)
    db.commit()
    
    return None
