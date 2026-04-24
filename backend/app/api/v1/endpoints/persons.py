"""
Person endpoints for managing participants/subjects in projects.
Handles person CRUD operations within project context.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.database import get_db
from app.models.models import User, Person, Project, Event, KnownPerson
from app.schemas.schemas import PersonCreate, PersonUpdate, PersonResponse, MessageResponse, PersonPromote
from app.api.dependencies import get_current_user


router = APIRouter(tags=["Persons"])

@router.get("/known-persons")
async def list_known_persons(db: Session = Depends(get_db)):
    """List all known persons (lab members) available in the system."""
    import os
    known = db.query(KnownPerson).order_by(KnownPerson.name).all()
    results = []
    for kp in known:
        image_url = None
        if kp.image_path:
            filename = os.path.basename(kp.image_path)
            image_url = f"/dataset_known/{filename}"
        results.append({
            "pid": kp.pid,
            "name": kp.name,
            "image_url": image_url
        })
    return results


@router.post("/projects/{project_id}/persons", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    project_id: UUID,
    person_data: PersonCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually create a person record in a project.
    
    Typically persons are created automatically by the ML pipeline,
    but this endpoint allows manual addition if needed.
    
    - **name**: Person's full name (required)
    - **pid**: Person ID from dataset (e.g. 'Arun.A')
    - **consent_status**: Consent status (pending, granted, denied, expired)
    - **confidence**: ML match confidence (0.0 - 1.0)
    - **bbox**: Bounding box {x, y, width, height}
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
    
    # Build person dict, converting bbox to plain dict if needed
    person_dict = person_data.model_dump(exclude={"bbox"})
    if person_data.bbox:
        person_dict["bbox"] = person_data.bbox.model_dump()
    
    new_person = Person(
        **person_dict,
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
        event_metadata={"person_name": new_person.name, "pid": new_person.pid}
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
    List all persons in a project, including the first image URL each person was detected in.
    """
    from app.models.models import ImagePerson, Image as ImageModel
    
    # Verify project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    persons = db.query(Person).filter(Person.project_id == project_id).all()
    
    if not persons:
        return []

    person_ids = [p.id for p in persons]
    
    # 1. Fetch all ImagePerson records for these persons
    assocs = db.query(ImagePerson).filter(ImagePerson.person_id.in_(person_ids)).all()
    
    # 2. Extract image IDs and get corresponding Image records
    image_ids = list({a.image_id for a in assocs})
    images = db.query(ImageModel).filter(ImageModel.id.in_(image_ids)).all()
    
    # Create lookup dictionaries
    images_by_id = {img.id: img for img in images}
    
    from collections import defaultdict
    detections_by_person = defaultdict(list)
    
    for assoc in assocs:
        img = images_by_id.get(assoc.image_id)
        if img:
            detections_by_person[assoc.person_id].append({
                "image_id": str(img.id),
                "image_url": img.file_url,
                "bbox": assoc.bbox or {},
                "confidence": assoc.confidence
            })
            
    # Build response
    result = []
    for person in persons:
        person_data = PersonResponse.model_validate(person)
        
        person_detections = detections_by_person.get(person.id, [])
        person_data.detections = person_detections
        
        # Keep backwards compatibility for the 'first' detection
        if person_detections:
            first_det = person_detections[0]
            person_data.image_url = first_det["image_url"]
            person_data.image_id = first_det["image_id"]
            if first_det.get("bbox"):
                person_data.bbox = first_det["bbox"]
                
        result.append(person_data)
        
    return result



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
    
    new_pid = update_data.get("pid")
    pid_changed = False
    
    if new_pid is not None and new_pid != person.pid:
        pid_changed = True
        
        # Check if this precise PID already exists in this project
        target_person = db.query(Person).filter(
            Person.project_id == person.project_id,
            Person.pid == new_pid,
            Person.id != person.id
        ).first()
        
        if target_person:
            # Transfer all image associations to the existing record
            from app.models.models import ImagePerson
            assoc_links = db.query(ImagePerson).filter(ImagePerson.person_id == person.id).all()
            for link in assoc_links:
                existing_target_link = db.query(ImagePerson).filter(
                    ImagePerson.person_id == target_person.id,
                    ImagePerson.image_id == link.image_id
                ).first()
                if existing_target_link:
                    # Preserve bbox / confidence from incoming link if target link lacks them
                    if not existing_target_link.bbox and link.bbox:
                        existing_target_link.bbox = link.bbox
                    if not existing_target_link.confidence and link.confidence:
                        existing_target_link.confidence = link.confidence
                    db.delete(link)
                else:
                    link.person_id = target_person.id
            
            # Delete the current duplicate person record
            db.delete(person)
            db.commit()
            
            # Point our working reference to the merged target
            person = target_person

    for field, value in update_data.items():
        setattr(person, field, value)
    
    db.commit()
    db.refresh(person)
    
    # If PID was manually changed, try to auto-match previously uploaded consent PDFs
    if pid_changed:
        from app.api.v1.endpoints.consent import match_consents_to_persons
        match_consents_to_persons(person.project_id, db)
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


@router.post("/projects/{project_id}/persons/{person_id}/promote", response_model=PersonResponse)
async def promote_person(
    project_id: UUID,
    person_id: UUID,
    promote_data: PersonPromote,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Promote an unknown person to the global known dataset.
    Extracts their face embedding and saves it to KnownPersons.
    """
    from app.ml.face_recognition import ml_service
    
    person = db.query(Person).filter(
        Person.id == person_id,
        Person.project_id == project_id
    ).first()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
        
    if not person.embedding:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Person does not have an extracted face vector (embedding)."
        )
        
    existing_known = db.query(KnownPerson).filter(KnownPerson.pid == promote_data.pid).first()
    if existing_known:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Person ID '{promote_data.pid}' already exists in the dataset."
        )

    known_person = KnownPerson(
        name=promote_data.name,
        pid=promote_data.pid,
        embedding=person.embedding
    )
    db.add(known_person)
    
    person.name = promote_data.name
    person.pid = promote_data.pid
    
    # Check if there are other unknown persons in this project with the same embedding or extremely similar?
    # Not needed for MVP: just update this specific person to the new identity, 
    # others will be resolved next time project is processed or we can do it later.
    
    db.commit()
    db.refresh(person)
    db.refresh(known_person)
    
    if hasattr(ml_service, "known_persons"):
        ml_service.known_persons.append({
            "name": known_person.name,
            "pid": known_person.pid,
            "embedding": known_person.embedding,
            "image_path": None
        })
    
    event = Event(
        project_id=project_id,
        user_id=current_user.id,
        event_type="person_promoted",
        description=f"Unknown Person promoted to Global Dataset as '{person.name}'",
        event_metadata={"person_id": str(person.id), "pid": person.pid}
    )
    db.add(event)
    db.commit()
    
    return person


@router.post("/known-persons/upload")
async def upload_known_person(
    name: str = Form(...),
    pid: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a reference photo and extract face embedding.

    If the PID already exists the new embedding is averaged with the stored
    embedding (L2-normalised running average). This gives the recognition
    model a multi-view representation — improving match accuracy across
    varying lighting conditions, angles, and expressions.

    Uploading 2-5 different photos of the same person is recommended for
    best recognition results.
    """
    import numpy as np
    from app.ml.face_recognition import ml_service
    from app.core.config import settings
    from pathlib import Path
    import shutil

    dataset_dir = Path(settings.DATASET_KNOWN_DIR)
    dataset_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename).suffix.lower() or ".jpg"
    safe_pid = "".join(c for c in pid if c.isalnum() or c in (".", "_", "-"))
    new_filename = f"{safe_pid}{file_ext}"
    file_path = dataset_dir / new_filename

    # Write uploaded image to disk (always replace — keeps thumbnail fresh)
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        from PIL import Image as PILImage
        import cv2

        img_bgr = cv2.imread(str(file_path))
        if img_bgr is None:
            raise Exception("Cannot read uploaded image — unsupported format?")

        # Detect face crop; fall back to full image if YOLO finds nothing
        results = ml_service.yolo(img_bgr, verbose=False)[0]
        if results.boxes is None or len(results.boxes) == 0:
            rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            face_img = PILImage.fromarray(rgb)
        else:
            box = results.boxes.xyxy.cpu().numpy()[0]
            x1, y1, x2, y2 = map(int, box)
            h, w = img_bgr.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)
            rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            face_img = PILImage.fromarray(rgb[y1:y2, x1:x2])

        new_embedding: list = ml_service._get_embedding(face_img)
        new_emb_arr = np.array(new_embedding, dtype="float32")

        existing: KnownPerson | None = db.query(KnownPerson).filter(KnownPerson.pid == pid).first()

        if existing:
            # ── Multi-sample averaging ────────────────────────────────────
            # Average the incoming embedding with the stored one and
            # re-normalise to unit length. This accumulates information
            # from multiple photos, making the representation more robust.
            if existing.embedding:
                old_emb_arr = np.array(existing.embedding, dtype="float32")
                avg_arr = old_emb_arr + new_emb_arr          # element-wise sum
                norm = np.linalg.norm(avg_arr)
                if norm > 1e-10:
                    avg_arr /= norm                           # re-normalise
                averaged_embedding = avg_arr.tolist()
            else:
                averaged_embedding = new_embedding

            existing.embedding = averaged_embedding
            existing.name = name                              # allow name update
            existing.image_path = str(file_path)             # update thumbnail
            db.commit()
            db.refresh(existing)

            # Sync in-memory cache
            if hasattr(ml_service, "known_persons"):
                for entry in ml_service.known_persons:
                    if entry.get("pid") == pid:
                        entry["embedding"] = averaged_embedding
                        entry["image_path"] = str(file_path)
                        break

            return {
                "pid": pid,
                "name": name,
                "image_url": f"/dataset_known/{new_filename}",
                "updated": True,
                "message": "Embedding averaged with existing sample — recognition improved."
            }

        else:
            # ── First upload for this person ──────────────────────────────
            known_person = KnownPerson(
                name=name,
                pid=pid,
                image_path=str(file_path),
                embedding=new_embedding
            )
            db.add(known_person)
            db.commit()
            db.refresh(known_person)

            if hasattr(ml_service, "known_persons"):
                ml_service.known_persons.append({
                    "name": name,
                    "pid": pid,
                    "embedding": new_embedding,
                    "image_path": str(file_path)
                })

            return {
                "pid": pid,
                "name": name,
                "image_url": f"/dataset_known/{new_filename}",
                "updated": False,
                "message": "New person added to dataset."
            }

    except Exception as e:
        # Only remove file if this was a brand-new person (don't wipe old image)
        existing_check = db.query(KnownPerson).filter(KnownPerson.pid == pid).first()
        if not existing_check and file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/known-persons/{pid}", status_code=204)
async def delete_known_person(
    pid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a known person from the dataset.

    Removes the DB record, deletes the reference image from disk, and
    immediately evicts the entry from the in-memory ML cache so future
    recognition runs no longer match against this person.
    """
    from app.ml.face_recognition import ml_service
    import os

    kp = db.query(KnownPerson).filter(KnownPerson.pid == pid).first()
    if not kp:
        raise HTTPException(status_code=404, detail="Known person not found.")

    # Remove image file from disk
    if kp.image_path and os.path.exists(kp.image_path):
        try:
            os.remove(kp.image_path)
        except OSError:
            pass  # Non-fatal — record still deleted

    # Evict from in-memory ML cache immediately
    if hasattr(ml_service, "known_persons"):
        ml_service.known_persons = [
            kp_entry for kp_entry in ml_service.known_persons
            if kp_entry.get("pid") != pid
        ]

    db.delete(kp)
    db.commit()
    # 204 No Content — no return body needed
