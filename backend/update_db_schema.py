
from app.db.database import engine
from sqlalchemy import text

def update_schema():
    print("Updating database schema...")
    with engine.begin() as conn:
        # Add columns to users table
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_image_url TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS face_embedding JSONB"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_pdf_url TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_pdf_path TEXT"))
            print("Updated users table.")
        except Exception as e:
            print(f"Error updating users table: {e}")

        # Add columns to persons table
        try:
            conn.execute(text("ALTER TABLE persons ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL"))
            conn.execute(text("ALTER TABLE persons ADD COLUMN IF NOT EXISTS face_embedding JSONB"))
            print("Updated persons table.")
        except Exception as e:
            print(f"Error updating persons table: {e}")

if __name__ == "__main__":
    update_schema()
