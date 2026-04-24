"""
Face Recognition Service — Architecture v2

Loads a known-persons dataset from a folder of named face images at startup.
The filename (without extension) is used as the person's name and pid.

Example dataset structure:
    dataset_known/
        Arun.A.jpg
        Barath Kumar.R.jpg
        Dhivya.J.jpg
        ...

Processing flow:
1. load_known_persons_from_dataset() at init → builds list of {name, pid, embedding}
2. detect_faces_in_image(image_path) → detect faces + crop
3. match_face(embedding, known_persons) → best match name/pid + score
4. process_image(image_path) → returns structured result:
   {
     image_name, image_width, image_height,
     faces: [{bbox, person_name, person_id (pid), confidence}]
   }
"""

import os
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from facenet_pytorch import InceptionResnetV1
from PIL import Image
import torchvision.transforms as transforms
from typing import List, Dict, Optional, Any

try:
    from sklearn.metrics.pairwise import cosine_similarity as sk_cosine
except ImportError:
    sk_cosine = None


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two 1-D vectors."""
    if sk_cosine is not None:
        return float(sk_cosine(a.reshape(1, -1), b.reshape(1, -1))[0][0])
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-10
    return float(np.dot(a, b) / denom)


# Identity match threshold: score must exceed this to name/identify a person.
# Raised from 0.60 → 0.72 to reduce false-positive name matches.
IDENTITY_THRESHOLD = 0.72
# Consent threshold: faces scoring above this against a known consented person
# are treated as consented even if not confidently identified by name.
# Raised from 0.25 → 0.35 to reduce erroneous consent attribution for Unknowns.
CONSENT_THRESHOLD  = 0.35

# Ambiguity margin: if the best and second-best candidate scores are within
# this margin of each other, reject the match as ambiguous (return Unknown).
AMBIGUITY_MARGIN   = 0.05


class FaceRecognitionService:
    """Singleton face recognition service.
    
    Loads known persons from dataset at init and provides methods to
    detect + match faces in project images.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceRecognitionService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def _initialize(self, dataset_known_dir: Optional[str] = None):
        if self._initialized:
            return
            
        print("[INFO] Initializing FaceRecognitionService...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[INFO] Using device: {self.device}")

        # Load YOLO model (face detection)
        model_path = os.path.join(os.path.dirname(__file__), "yolov8n-face.pt")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO model not found at {model_path}")
        self.yolo = YOLO(model_path)

        # Load FaceNet embedding model
        self.embed_model = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)

        # Preprocessing pipeline for face crops
        self.prep_transform = transforms.Compose([
            transforms.Resize((160, 160)),
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        ])

        # Known persons loaded from dataset
        self.known_persons: List[Dict] = []
        
        # Load dataset if path provided at init time
        if dataset_known_dir and os.path.isdir(dataset_known_dir):
            self.load_known_persons_from_dataset(dataset_known_dir)
        
        self._initialized = True
        print("[INFO] FaceRecognitionService initialized.")

    # ------------------------------------------------------------------
    # Dataset Loading
    # ------------------------------------------------------------------

    def load_known_persons_from_records(self, records: list) -> int:
        """Load known persons directly from pre-computed DB records.

        Each record must have: pid, name, embedding (list of floats), image_path (optional).
        This is the fast path used on restart when embeddings are already cached in the DB.
        Returns number of persons successfully loaded.
        """
        loaded = []
        for rec in records:
            embedding = rec.get("embedding") if isinstance(rec, dict) else getattr(rec, "embedding", None)
            pid = rec.get("pid") if isinstance(rec, dict) else getattr(rec, "pid", None)
            name = rec.get("name") if isinstance(rec, dict) else getattr(rec, "name", None)
            image_path = rec.get("image_path") if isinstance(rec, dict) else getattr(rec, "image_path", None)

            if not embedding or not pid:
                continue
            loaded.append({
                "name": name,
                "pid": pid,
                "embedding": embedding,
                "image_path": image_path,
            })

        self.known_persons = loaded
        print(f"[INFO] Loaded {len(loaded)} known persons from cached DB records (no re-encoding).")
        return len(loaded)

    def load_known_persons_from_dataset(self, dataset_dir: str) -> int:
        """Load known persons from a folder of named face images.
        
        Each file in dataset_dir should be named:  <PersonName>.jpg
        e.g. 'Arun.A.jpg' → name='Arun.A', pid='Arun.A'
        
        Returns number of persons successfully loaded.
        """
        if not os.path.isdir(dataset_dir):
            print(f"[WARNING] Dataset directory not found: {dataset_dir}")
            return 0

        supported_exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
        loaded = []

        for fname in sorted(os.listdir(dataset_dir)):
            if not fname.lower().endswith(supported_exts):
                continue

            img_path = os.path.join(dataset_dir, fname)
            # Person name and pid derived from filename (without extension)
            person_name = os.path.splitext(fname)[0]
            person_pid = person_name  # Use name as pid (unique within dataset)

            try:
                img_bgr = cv2.imread(img_path)
                if img_bgr is None:
                    print(f"[WARNING] Could not read image: {img_path}")
                    continue

                # Detect face in the known-person image
                results = self.yolo(img_bgr, verbose=False)[0]
                if results.boxes is None or len(results.boxes) == 0:
                    # No face detected — try embedding the whole image as fallback
                    print(f"[WARNING] No face detected in dataset image: {fname}, using full image")
                    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
                    face_img = Image.fromarray(rgb)
                else:
                    # Use the first (highest confidence) detected face
                    box = results.boxes.xyxy.cpu().numpy()[0]
                    x1, y1, x2, y2 = map(int, box)
                    h, w = img_bgr.shape[:2]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w - 1, x2), min(h - 1, y2)
                    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
                    face_img = Image.fromarray(rgb[y1:y2, x1:x2])

                embedding = self._get_embedding(face_img)
                loaded.append({
                    "name": person_name,
                    "pid": person_pid,
                    "embedding": embedding,
                    "image_path": img_path   # absolute path to dataset image
                })
                print(f"[INFO] Loaded known person: {person_name}")


            except Exception as e:
                print(f"[ERROR] Failed to process dataset image {fname}: {e}")
                continue

        self.known_persons = loaded
        print(f"[INFO] Loaded {len(loaded)} known persons from dataset.")
        return len(loaded)

    # ------------------------------------------------------------------
    # Core ML Methods
    # ------------------------------------------------------------------

    def _get_embedding(self, face_image: Image.Image) -> List[float]:
        """Generate normalized embedding vector for a face crop."""
        tensor = self.prep_transform(face_image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            emb = self.embed_model(tensor).cpu().numpy()[0]
        emb = emb / (np.linalg.norm(emb) + 1e-10)
        return emb.tolist()

    def _detect_faces(self, img_bgr: np.ndarray):
        """Run YOLO on a BGR image. Returns list of (bbox_dict, face_pil_image).

        Detection confidence (conf) is intentionally kept LOW (0.50) because YOLO's
        only job here is to locate face regions. The identity gating is handled
        separately by FaceNet cosine matching with IDENTITY_THRESHOLD=0.72.

        A high YOLO conf (e.g. 0.70) causes evening-lit, slightly angled, or
        backlit faces to be silently skipped — never written to ImagePerson —
        so no bounding box appears in the redaction view at all.
        """
        results = self.yolo(img_bgr, verbose=False, conf=0.50)[0]
        if results.boxes is None:
            return []

        h, w = img_bgr.shape[:2]
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        faces = []

        for box in results.boxes.xyxy.cpu().numpy():
            x1, y1, x2, y2 = map(int, box)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)

            if x2 <= x1 or y2 <= y1:
                continue
            
            width = x2 - x1
            height = y2 - y1

            # Minimum face size: 60 px on each side.
            # 80 px (previous value) was too aggressive — it excluded subjects
            # photographed at any distance or mild angle. FaceNet produces reliable
            # embeddings from crops as small as 60 px because it resizes to 160×160
            # internally. Background specks are filtered by the aspect ratio check below.
            min_size = 60
            if width < min_size or height < min_size:
                continue    
            
            ratio = width / height
            if ratio < 0.5 or ratio > 1.5:
                continue

            bbox = {
                "x": x1,
                "y": y1,
                "width": x2 - x1,
                "height": y2 - y1
            }
            face_crop = Image.fromarray(rgb[y1:y2, x1:x2])
            faces.append((bbox, face_crop))

        return faces

    def match_face(
        self,
        target_embedding: List[float],
        threshold: float = IDENTITY_THRESHOLD,
        consent_threshold: float = CONSENT_THRESHOLD,
    ) -> tuple:
        """Match a target embedding against all known persons.

        Returns a 3-tuple:
            (confident_match, probable_match, score)

            confident_match : person dict if score >= threshold AND the match is
                              unambiguous (2nd-best is more than AMBIGUITY_MARGIN below best)
            probable_match  : person dict if consent_threshold <= score < threshold
                              (same object as confident_match when score >= threshold)
                              None if score < consent_threshold
            score           : best cosine similarity found
        """
        if not self.known_persons:
            return None, None, 0.0

        target = np.array(target_embedding, dtype="float32")

        # Collect ALL scores so we can apply the ambiguity margin check
        scored = []
        for person in self.known_persons:
            known_emb = np.array(person["embedding"], dtype="float32")
            score = _cosine_sim(target, known_emb)
            scored.append((score, person))

        # Sort descending by score
        scored.sort(key=lambda x: x[0], reverse=True)

        best_score, best_match = scored[0]
        second_score = scored[1][0] if len(scored) > 1 else -1.0

        if best_score >= threshold:
            # Ambiguity check: reject if the runner-up is within AMBIGUITY_MARGIN
            if best_score - second_score < AMBIGUITY_MARGIN:
                print(
                    f"[MATCH] Ambiguous: best={best_score:.3f} ({best_match['name']}), "
                    f"2nd={second_score:.3f} ({scored[1][1]['name']}) — returning Unknown"
                )
                # Still return probable match for consent-pid tracking
                if best_score >= consent_threshold:
                    return None, best_match, best_score
                return None, None, best_score
            # Confident, unambiguous identity match
            return best_match, best_match, best_score
        elif best_score >= consent_threshold:
            # Below identity threshold but above consent threshold
            return None, best_match, best_score
        return None, None, best_score

    # ------------------------------------------------------------------
    # Public API: process a single image file
    # ------------------------------------------------------------------


    def process_image(self, image_path: str, threshold: float = IDENTITY_THRESHOLD) -> Optional[Dict]:
        """Process a single image file: detect faces, match against dataset.

        Returns structured result dict:
        {
            "image_name": str,
            "image_width": int,
            "image_height": int,
            "faces": [
                {
                    "bbox":        {x, y, width, height},
                    "person_name": str | None,   # matched name (confident match only)
                    "person_id":   str | None,   # matched pid  (confident match only)
                    "confidence":  float,
                    "consent_pid": str | None,   # best-match pid above CONSENT_THRESHOLD
                                                 # (may differ from person_id for low-confidence faces)
                },
            ]
        }
        Returns None if image cannot be read.
        """
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            print(f"[WARNING] Cannot read image: {image_path}")
            return None

        h, w = img_bgr.shape[:2]
        filename = os.path.basename(image_path)

        detected_faces = self._detect_faces(img_bgr)
        faces_output = []

        for bbox, face_pil in detected_faces:
            embedding = self._get_embedding(face_pil)
            match, probable, score = self.match_face(embedding, threshold)

            faces_output.append({
                "bbox":        bbox,
                "person_name": match["name"] if match else None,
                "person_id":   match["pid"]  if match else None,
                "confidence":  round(score, 4),
                "embedding":   embedding,
                # consent_pid: best-match pid even if below identity threshold
                "consent_pid": (match or probable or {}).get("pid"),
            })

        return {
            "image_name":   filename,
            "image_width":  w,
            "image_height": h,
            "faces":        faces_output,
        }

    # ------------------------------------------------------------------
    # Legacy compat methods (kept for any lingering callers)
    # ------------------------------------------------------------------

    def detect_and_crop(self, image_bytes: bytes) -> List[Image.Image]:
        """Detect faces in raw image bytes. Returns list of PIL face crops."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return []
        pairs = self._detect_faces(img_bgr)
        return [face for _, face in pairs]

    def get_embedding(self, face_image: Image.Image) -> List[float]:
        """Public wrapper for embedding generation."""
        return self._get_embedding(face_image)


# ---------------------------------------------------------------------------
# Module-level singleton — initialized lazily on first import.
# The dataset is loaded in main.py startup event so the config path is resolved.
# ---------------------------------------------------------------------------
ml_service = FaceRecognitionService()
