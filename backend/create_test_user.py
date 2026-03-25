"""
Create a test admin user directly in the database
"""

import sys
sys.path.append('.')

from app.db.database import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

def create_test_user():
    db = SessionLocal()
    
    try:
        # Check if user exists
        existing = db.query(User).filter(User.email == "admin@test.com").first()
        if existing:
            print("✓ Test user already exists")
            print(f"Email: admin@test.com")
            print(f"Password: admin123")
            return
        
        # Create test user
        test_user = User(
            email="admin@test.com",
            password_hash=get_password_hash("admin123"),
            full_name="Test Admin",
            role="admin",
            is_active=True
        )
        
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        print("✓ Test user created successfully!")
        print(f"Email: admin@test.com")
        print(f"Password: admin123")
        print(f"Role: admin")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
