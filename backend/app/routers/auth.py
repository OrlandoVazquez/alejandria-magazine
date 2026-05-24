"""Auth router: register, login, manage users."""
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, verify_token
from app.models import UserModel, UserRegisterDTO, UserLoginDTO, TokenResponse, UserResponse, UserRole
from app.database import get_session

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(
    req: UserRegisterDTO,
    session: AsyncSession = Depends(get_session)
):
    """Register a new user."""
    # Check email exists
    stmt = select(UserModel).where(UserModel.email == req.email)
    existing = await session.execute(stmt)
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = UserModel(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    
    # Generate token
    access_token = create_access_token({"user_id": str(user.id), "email": user.email, "role": user.role.value})
    
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(
    req: UserLoginDTO,
    session: AsyncSession = Depends(get_session)
):
    """Login user."""
    stmt = select(UserModel).where(UserModel.email == req.email)
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"user_id": str(user.id), "email": user.email, "role": user.role.value})
    
    return TokenResponse(access_token=access_token)


def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    """Dependency to extract and validate user token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.replace("Bearer ", "")
    token_data = verify_token(token)
    
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return token_data


@router.get("/me", response_model=UserResponse)
async def get_me(
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get current authenticated user info."""
    stmt = select(UserModel).where(UserModel.id == UUID(token_data["user_id"]))
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse.from_orm(user)


@router.post("/dev/promote-reviewer", response_model=UserResponse)
async def promote_to_reviewer(
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Promote user to reviewer (dev only)."""
    if not settings.ENABLE_DEV_ROLE_PROMOTION:
        raise HTTPException(status_code=403, detail="Role promotion disabled")
    
    stmt = select(UserModel).where(UserModel.id == UUID(token_data["user_id"]))
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = UserRole.REVIEWER
    session.add(user)
    await session.commit()
    await session.refresh(user)
    
    return UserResponse.from_orm(user)
