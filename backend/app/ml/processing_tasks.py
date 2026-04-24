"""
Background ML processing task registry.

Provides:
  - An in-memory task store (resets on server restart — acceptable for prototype)
  - run_processing_task(): the function executed by the thread pool; handles parallel
    YOLO+FaceNet inference across all project images, then sequential DB writes
  - submit_processing_task(): submits the task to a shared 4-worker thread pool

Architecture
────────────
  Phase A (parallel)  — 4 threads run ml_service.process_image() on different images
                        simultaneously, collecting (image_id, result) pairs.
  Phase B (sequential)— one thread does all DB writes in batches of 20 commits,
                        which is safe since SQLAlchemy sessions are not thread-safe.
"""

from __future__ import annotations

import uuid
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, Optional, Callable

# ── Global task registry ─────────────────────────────────────────────────────

_tasks: Dict[str, Dict[str, Any]] = {}
_tasks_lock = threading.Lock()

# 4-worker pool shared across all requests (safe for CPU-bound inference)
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ml_worker")


# ── Task management helpers ───────────────────────────────────────────────────

def create_task(project_id: str) -> str:
    task_id = str(uuid.uuid4())
    with _tasks_lock:
        _tasks[task_id] = {
            "task_id":      task_id,
            "project_id":   project_id,
            "status":       "pending",    # pending | processing | saving | done | error
            "progress":     0,
            "total":        0,
            "current_image": None,
            "result":       None,
            "error":        None,
        }
    return task_id


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    with _tasks_lock:
        t = _tasks.get(task_id)
        return dict(t) if t else None          # return a snapshot copy


def _update_task(task_id: str, **kwargs) -> None:
    with _tasks_lock:
        if task_id in _tasks:
            _tasks[task_id].update(kwargs)


# ── Core background runner ────────────────────────────────────────────────────

def run_processing_task(
    task_id: str,
    project_id_str: str,
    db_factory: Callable,          # SessionLocal callable
    dataset_dir: str,
) -> None:
    """
    Execute ML processing for an entire project in a background thread.

    Called by submit_processing_task() — never call directly from async code.

    DB session is created inside this thread (each thread must own its session).
    """
    from app.models.models import Person, Image as ImageModel, ImagePerson, KnownPerson, Event
    from app.ml.face_recognition import ml_service, _cosine_sim, IDENTITY_THRESHOLD
    from app.api.v1.endpoints.consent import match_consents_to_persons
    from uuid import UUID
    import os, numpy as np

    project_id = UUID(project_id_str)
    db = db_factory()

    try:
        _update_task(task_id, status="processing")

        # ── Ensure ML models + known persons are loaded ──────────────────────
        if not ml_service._initialized:
            ml_service._initialize(dataset_known_dir=dataset_dir)
        elif not ml_service.known_persons:
            ml_service.load_known_persons_from_dataset(dataset_dir)

        from app.models.models import Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            _update_task(task_id, status="error", error="Project not found")
            return

        images = db.query(ImageModel).filter(ImageModel.project_id == project_id).all()
        if not images:
            _update_task(task_id, status="error", error="No images found in project")
            return

        _update_task(task_id, total=len(images), progress=0)

        # ── Clean up unknowns from previous runs ──────────────────────────────
        unknowns_old = db.query(Person).filter(
            Person.project_id == project_id,
            Person.pid.is_(None),
        ).all()
        for old in unknowns_old:
            db.delete(old)
        db.commit()

        known_db: dict = {kp.pid: kp for kp in db.query(KnownPerson).all()}

        # ── Phase A: parallel ML inference ────────────────────────────────────
        # Each worker calls ml_service.process_image() on a different image.
        # YOLO + FaceNet release the GIL for numpy/torch ops, so 4-thread
        # parallelism gives a real speedup even on CPU.

        # Build list of (image_obj, resolved_path)
        image_list = []
        for img in images:
            img_path = img.file_path
            if not img_path or not os.path.exists(img_path):
                if img_path:
                    import re
                    fname = os.path.basename(img_path)
                    from app.core.config import settings as _cfg
                    img_path = os.path.join(_cfg.IMAGES_DIR, str(project_id), fname)
                if not img_path or not os.path.exists(img_path):
                    print(f"[TASK][WARN] Image file not found: {img.file_path}")
                    continue
            image_list.append((img, img_path))

        # Submit all inference jobs — each is a (image_obj, ml_result) pair
        inference_results: list = []   # ordered list of (image_obj, result|None)

        # Use a nested executor so we don't saturate the shared pool entirely
        with ThreadPoolExecutor(max_workers=4, thread_name_prefix="ml_infer") as pool:
            future_to_img = {
                pool.submit(ml_service.process_image, path): img_obj
                for img_obj, path in image_list
            }
            for future in as_completed(future_to_img):
                img_obj = future_to_img[future]
                try:
                    result = future.result()
                except Exception as exc:
                    print(f"[TASK][ERROR] ML failed on {img_obj.name}: {exc}")
                    result = None
                inference_results.append((img_obj, result))

                # Update progress after each completed inference
                done_count = len(inference_results)
                _update_task(
                    task_id,
                    progress=done_count,
                    current_image=img_obj.name,
                )

        # ── Phase B: sequential DB writes ─────────────────────────────────────
        _update_task(task_id, status="saving", current_image=None)

        total_faces   = 0
        total_matched = 0
        unknown_counter = 0
        project_unknowns: list = []   # Person objects with pid=None
        all_results   = []

        UNKNOWN_GROUP_THRESH = max(IDENTITY_THRESHOLD, 0.75)
        BATCH_SIZE = 20   # commit every N images to keep transactions short

        for batch_start in range(0, len(inference_results), BATCH_SIZE):
            batch = inference_results[batch_start: batch_start + BATCH_SIZE]

            for img_obj, result in batch:
                if result is None:
                    continue

                total_faces += len(result["faces"])
                image_faces_for_response = []

                for face in result["faces"]:
                    bbox       = face["bbox"]
                    ml_pid     = face["person_id"]
                    ml_name    = face["person_name"]
                    confidence = face["confidence"]

                    if ml_pid:
                        # ── Identified person ──────────────────────────────
                        db_known = known_db.get(ml_pid)
                        resolved_name = db_known.name if db_known else ml_name
                        resolved_pid  = ml_pid
                        total_matched += 1

                        person = db.query(Person).filter(
                            Person.project_id == project_id,
                            Person.pid == resolved_pid,
                        ).first()

                        if not person:
                            person = Person(
                                project_id=project_id,
                                name=resolved_name,
                                pid=resolved_pid,
                                confidence=confidence,
                                bbox=bbox,
                                embedding=face.get("embedding"),
                                consent_status="pending",
                            )
                            db.add(person)
                            db.flush()   # get person.id without committing
                        else:
                            person.name      = resolved_name
                            person.confidence = confidence
                            person.bbox      = bbox
                            if face.get("embedding"):
                                person.embedding = face.get("embedding")
                    else:
                        # ── Unknown person ─────────────────────────────────
                        face_embedding = face.get("embedding")
                        matched_unknown = None

                        if face_embedding is not None:
                            target_emb = np.array(face_embedding, dtype="float32")
                            best_score = -1.0

                            for unk_person in project_unknowns:
                                if unk_person.embedding:
                                    unk_emb = np.array(unk_person.embedding, dtype="float32")
                                    score   = _cosine_sim(target_emb, unk_emb)
                                    if score > best_score:
                                        best_score    = score
                                        matched_unknown = unk_person

                            if best_score >= UNKNOWN_GROUP_THRESH and matched_unknown:
                                person            = matched_unknown
                                person.confidence = confidence
                                person.bbox       = bbox
                                resolved_name     = person.name
                                resolved_pid      = None
                            else:
                                unknown_counter += 1
                                resolved_name   = f"Unknown Person {unknown_counter}"
                                resolved_pid    = None
                                person = Person(
                                    project_id=project_id,
                                    name=resolved_name,
                                    pid=None,
                                    confidence=confidence,
                                    bbox=bbox,
                                    embedding=face_embedding,
                                    consent_status="pending",
                                )
                                db.add(person)
                                db.flush()
                                project_unknowns.append(person)
                        else:
                            unknown_counter += 1
                            resolved_name = f"Unknown Person {unknown_counter}"
                            resolved_pid  = None
                            person = Person(
                                project_id=project_id,
                                name=resolved_name,
                                pid=None,
                                confidence=confidence,
                                bbox=bbox,
                                consent_status="pending",
                            )
                            db.add(person)
                            db.flush()

                    # ── Link image → person ───────────────────────────────
                    consent_pid  = face.get("consent_pid")
                    existing_link = db.query(ImagePerson).filter(
                        ImagePerson.image_id  == img_obj.id,
                        ImagePerson.person_id == person.id,
                    ).first()

                    if existing_link:
                        existing_link.bbox       = bbox
                        existing_link.confidence = confidence
                        existing_link.consent_pid = consent_pid
                    else:
                        db.add(ImagePerson(
                            image_id   = img_obj.id,
                            person_id  = person.id,
                            bbox       = bbox,
                            confidence = confidence,
                            consent_pid= consent_pid,
                        ))

                    image_faces_for_response.append({
                        "bbox":        bbox,
                        "person_name": resolved_name,
                        "person_id":   resolved_pid,
                        "confidence":  confidence,
                    })

                all_results.append({
                    "image_name":   result["image_name"],
                    "image_width":  result["image_width"],
                    "image_height": result["image_height"],
                    "faces":        image_faces_for_response,
                })

            # Batch commit every BATCH_SIZE images
            db.commit()

        # ── Consent matching pass ──────────────────────────────────────────
        consent_matched = match_consents_to_persons(project_id, db)
        print(f"[TASK] Consent matching: {consent_matched} PDF(s) matched")

        # ── Persist event ──────────────────────────────────────────────────
        db.add(Event(
            project_id=project_id,
            event_type="project_processed",
            description=(
                f"ML processing complete: {len(all_results)} images, "
                f"{total_faces} faces, {total_matched} matched, "
                f"{consent_matched} consent(s) auto-matched"
            ),
            event_metadata={
                "images_processed": len(all_results),
                "total_faces":      total_faces,
                "matched_faces":    total_matched,
                "unknown_faces":    total_faces - total_matched,
                "consents_matched": consent_matched,
            },
        ))
        db.commit()

        _update_task(
            task_id,
            status="done",
            progress=len(inference_results),
            result={
                "project_id":              project_id_str,
                "total_images_processed":  len(all_results),
                "total_faces_detected":    total_faces,
                "total_matched":           total_matched,
            },
        )
        print(f"[TASK] Processing complete for project {project_id_str}")

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        print(f"[TASK][ERROR] {exc}\n{tb}")
        try:
            db.rollback()
        except Exception:
            pass
        _update_task(task_id, status="error", error=str(exc))

    finally:
        db.close()


# ── Public submit helper ──────────────────────────────────────────────────────

def submit_processing_task(
    task_id: str,
    project_id_str: str,
    db_factory: Callable,
    dataset_dir: str,
) -> None:
    """Submit the processing job to the shared thread pool."""
    _executor.submit(
        run_processing_task,
        task_id,
        project_id_str,
        db_factory,
        dataset_dir,
    )
