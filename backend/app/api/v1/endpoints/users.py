
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import UserResponse
from app.api.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all active users.
    Requires authentication. Admin can use this to see all accounts.
    """
    users = db.query(User).filter(User.is_active == True).all()
    return users


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current user profile.
    """
    return current_user
