"""
Main FastAPI application.
Configures CORS, includes routers, and sets up the application.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.core.config import settings
from app.api.v1.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize ML service using cached DB embeddings where possible."""
    from app.ml.face_recognition import ml_service
    from app.core.config import settings
    from app.db.database import SessionLocal, engine
    from app.models.models import Base, KnownPerson
    import os

    dataset_dir = settings.DATASET_KNOWN_DIR
    print(f"[STARTUP] Dataset directory: {dataset_dir}")
    print(f"[STARTUP] Dataset exists: {os.path.isdir(dataset_dir)}")

    # 1. Ensure known_persons table exists
    Base.metadata.create_all(bind=engine)

    # 2. Initialize ML models (YOLO + FaceNet) — models only, no dataset loaded yet
    print("[STARTUP] Initializing ML models (YOLO + FaceNet)...")
    ml_service._initialize()  # no dataset_known_dir → skips dataset scan

    db = SessionLocal()
    try:
        # 3. Load cached embeddings from DB (fast path — no re-encoding)
        cached_records = db.query(KnownPerson).all()
        if cached_records:
            loaded = ml_service.load_known_persons_from_records(cached_records)
            print(f"[STARTUP] Fast-loaded {loaded} known persons from DB cache.")
        else:
            print("[STARTUP] No cached embeddings found in DB. Will encode from dataset images.")

        # 4. Find dataset images that are NOT yet in the DB and encode only those
        if os.path.isdir(dataset_dir):
            cached_pids = {rec.pid for rec in cached_records}
            supported_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
            new_images = [
                fname for fname in sorted(os.listdir(dataset_dir))
                if fname.lower().endswith(supported_exts)
                and os.path.splitext(fname)[0] not in cached_pids
            ]

            if new_images:
                print(f"[STARTUP] Found {len(new_images)} new dataset image(s) to encode...")
                # Encode only the new images
                ml_service.load_known_persons_from_dataset(dataset_dir)
                # Persist newly encoded persons to DB
                seeded = 0
                for kp in ml_service.known_persons:
                    pid = kp["pid"]
                    if pid not in cached_pids:
                        db_kp = KnownPerson(
                            pid=pid,
                            name=kp["name"],
                            image_path=kp.get("image_path"),
                            embedding=kp["embedding"],
                        )
                        db.add(db_kp)
                        seeded += 1
                db.commit()
                print(f"[STARTUP] Encoded and saved {seeded} new person(s) to DB.")

                # Merge previously cached records back into ml_service.known_persons
                # (load_known_persons_from_dataset replaced the list, so merge cached ones)
                if cached_records:
                    existing_pids = {kp["pid"] for kp in ml_service.known_persons}
                    for rec in cached_records:
                        if rec.pid not in existing_pids:
                            ml_service.known_persons.append({
                                "name": rec.name,
                                "pid": rec.pid,
                                "embedding": rec.embedding,
                                "image_path": rec.image_path,
                            })
                    print(f"[STARTUP] Total known persons in memory: {len(ml_service.known_persons)}")
            else:
                print("[STARTUP] All dataset images already cached — skipped re-encoding.")
        else:
            print(f"[STARTUP][WARNING] Dataset directory not found: {dataset_dir}")

    except Exception as e:
        print(f"[STARTUP] Error during known-persons initialization: {e}")
        db.rollback()
    finally:
        db.close()

    yield

    print("[SHUTDOWN] Application shutting down.")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="REST API for ConsentMap - A consent management system for image data collection",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS - MUST be first middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods including OPTIONS
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
    max_age=3600,
)

# Mount static files for uploads
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

# Mount dataset_known directory for global person portraits
dataset_path = Path(settings.DATASET_KNOWN_DIR)
dataset_path.mkdir(parents=True, exist_ok=True)
app.mount("/dataset_known", StaticFiles(directory=str(dataset_path)), name="dataset_known")

# Include API router
app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    """
    Root endpoint - API health check.
    Returns basic API information.
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring.
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
