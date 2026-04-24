"""
Core configuration settings for the FastAPI application.
Loads environment variables and provides application-wide settings.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    Uses pydantic for validation and type checking.
    """
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://consentmap_user:consentmap_pass@localhost:5433/consentmap_db"
    
    # JWT Authentication
    SECRET_KEY: str = "your-secret-key-change-this-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Application Info
    APP_NAME: str = "ConsentMap API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # CORS Settings
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174"
    
    # File upload settings
    # File upload settings
    UPLOAD_DIR: str = "uploads"
    IMAGES_DIR: str = "uploads/images"
    CONSENT_PDFS_DIR: str = "uploads/consent_pdfs"
    IDENTITY_DIR: str = "uploads/identity"
    USER_CONSENT_DIR: str = "uploads/user_consent"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_IMAGE_EXTENSIONS: set = {".jpg", ".jpeg", ".png", ".gif", ".bmp"}
    ALLOWED_PDF_EXTENSIONS: set = {".pdf"}
    
    # Known dataset for face recognition (folder of named face images)
    # Absolute path so it works regardless of uvicorn launch directory
    DATASET_KNOWN_DIR: str = r"C:\Users\hrayg\OneDrive\Desktop\consent-map-final\lovable\project-consent-flow\ml_model\SEED_PRISM_Collaborative\SEED_PRISM_Collaborative\git\25TS28VIT_Recognition_and_Redaction\consentmapdemo\dataset_known"

    
    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create global settings instance
settings = Settings()
