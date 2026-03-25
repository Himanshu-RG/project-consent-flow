"""
Quick script to create an admin user for testing.
Run this once to create the default admin account.
"""

import requests
import json

API_URL = "http://localhost:8000/api"

def create_admin_user():
    """Create default admin user"""
    
    user_data = {
        "email": "admin@consentmap.com",
        "password": "admin123",
        "full_name": "Admin User",
        "role": "admin"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/auth/register",
            json=user_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 201:
            print("✅ Admin user created successfully!")
            print(f"Email: {user_data['email']}")
            print(f"Password: {user_data['password']}")
            print("\nYou can now login with these credentials.")
        elif response.status_code == 400:
            print("⚠️  User might already exist. Try logging in with:")
            print(f"Email: {user_data['email']}")
            print(f"Password: {user_data['password']}")
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the API server.")
        print("Make sure the backend is running on http://localhost:8000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    print("Creating admin user...")
    create_admin_user()
