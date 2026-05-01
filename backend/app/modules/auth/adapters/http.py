from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.database import get_session
from app.modules.auth.application.dtos import RegisterDTO, LoginDTO, TokenResponse, UserResponse
from app.modules.auth.application.use_cases import RegisterUseCase, LoginUseCase, GetUserUseCase
from app.modules.auth.adapters.repository import UserRepositoryImpl
from app.core.security import verify_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(
    req: RegisterDTO,
    session: AsyncSession = Depends(get_session)
):
    """Registrar un nuevo usuario."""
    try:
        repo = UserRepositoryImpl(session)
        use_case = RegisterUseCase(repo)
        user = await use_case.execute(req.email, req.password, req.full_name)
        
        # Generar tokens
        login_use_case = LoginUseCase(repo)
        tokens = await login_use_case.execute(req.email, req.password)
        
        return tokens
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginDTO,
    session: AsyncSession = Depends(get_session)
):
    """Login de usuario."""
    try:
        repo = UserRepositoryImpl(session)
        use_case = LoginUseCase(repo)
        tokens = await use_case.execute(req.email, req.password)
        return tokens
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(
    authorization: str = None,
    session: AsyncSession = Depends(get_session)
):
    """Obtener información del usuario autenticado."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    token = authorization.replace("Bearer ", "")
    token_data = verify_token(token)
    
    if not token_data:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    try:
        repo = UserRepositoryImpl(session)
        use_case = GetUserUseCase(repo)
        user = await use_case.execute(token_data.user_id)
        return UserResponse.from_orm(user)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
