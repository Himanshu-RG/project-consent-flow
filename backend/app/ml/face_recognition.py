
import os
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from facenet_pytorch import InceptionResnetV1
from PIL import Image
import torchvision.transforms as transforms
try:
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    pass

class FaceRecognitionService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceRecognitionService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        print("[INFO] Initializing FaceRecognitionService...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[INFO] Using device: {self.device}")

        # Load YOLO model
        model_path = os.path.join(os.path.dirname(__file__), "yolov8n-face.pt")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO model not found at {model_path}")
        
        self.yolo = YOLO(model_path)
        
        # Load Facenet model
        self.embed_model = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        
        # Preprocessing transform
        self.prep_transform = transforms.Compose([
            transforms.Resize((160, 160)),
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        ])
        print("[INFO] Models loaded successfully.")

    def detect_and_crop(self, image_bytes):
        """
        Detect faces in an image and return cropped face images (PIL).
        """
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img_bgr is None:
            return []

        results = self.yolo(img_bgr, verbose=False)[0]

        if results.boxes is None:
            return []

        h, w = img_bgr.shape[:2]
        rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        crops = []
        for box in results.boxes.xyxy.cpu().numpy():
            x1, y1, x2, y2 = map(int, box)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w-1, x2), min(h-1, y2)

            if x2 <= x1 or y2 <= y1:
                continue

            face_crop = rgb[y1:y2, x1:x2]
            crops.append(Image.fromarray(face_crop))

        return crops

    def get_embedding(self, face_image: Image.Image):
        """
        Generate embedding for a single face crop.
        Returns a list of floats (embedding vector).
        """
        tensor = self.prep_transform(face_image).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            emb = self.embed_model(tensor).cpu().numpy()

        # Normalize
        emb /= (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-10)
        return emb[0].tolist()

    def match_face(self, target_embedding, known_embeddings, threshold=0.55):
        """
        Find best match for a target embedding among known embeddings.
        
        Args:
            target_embedding: List[float] (the face we want to identify)
            known_embeddings: List[Dict] - [{'id': 'person_id', 'embedding': List[float], 'name': '...'}, ...]
            threshold: float - Similarity threshold
            
        Returns:
            (best_match_id, score) or (None, score)
        """
        if not known_embeddings:
            return None, 0.0

        target = np.array(target_embedding).reshape(1, -1)
        
        best_score = -1.0
        best_match = None
        
        # We can optimize this using matrix multiplication for batch processing
        # But iterating is fine for typically small N
        for person in known_embeddings:
            known_emb = np.array(person['embedding']).reshape(1, -1)
            
            # Compute cosine similarity
            score = cosine_similarity(target, known_emb)[0][0]
            
            if score > best_score:
                best_score = float(score)
                best_match = person

        if best_score >= threshold:
            return best_match, best_score
            
        return None, best_score

# Singleton instance
ml_service = FaceRecognitionService()
