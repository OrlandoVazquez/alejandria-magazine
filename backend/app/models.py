"""Simplified models: DTOs and SQLAlchemy ORM schemas in one file."""
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, String, DateTime, Boolean, UUID as SA_UUID, ForeignKey, Text, Enum as SA_Enum
from sqlalchemy.orm import declarative_base

Base = declarative_base()


# ============ Enums ============


class UserRole(str, Enum):
    """User roles in the system."""
    AUTHOR = "author"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class ArticleStatus(str, Enum):
    """Article lifecycle states."""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"


class ScientificFormat(str, Enum):
    """Supported scientific formats."""
    APA = "apa"
    IEEE = "ieee"
    VANCOUVER = "vancouver"
    NONE = "none"


# ============ SQLAlchemy ORM Models ============


class UserModel(Base):
    """User account model."""
    __tablename__ = "users"

    id = Column(SA_UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SA_Enum(UserRole), default=UserRole.AUTHOR, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ArticleModel(Base):
    """Article model."""
    __tablename__ = "articles"

    id = Column(SA_UUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(512), nullable=False)
    body = Column(Text, default="", nullable=False)
    status = Column(SA_Enum(ArticleStatus), default=ArticleStatus.DRAFT, nullable=False, index=True)
    scientific_format = Column(SA_Enum(ScientificFormat), default=ScientificFormat.NONE)
    author_id = Column(SA_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(SA_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    cover_url = Column(String(1024))
    rejection_comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    published_at = Column(DateTime)


# ============ Pydantic DTOs ============


class UserRegisterDTO(BaseModel):
    """Register request."""
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=1, max_length=255)


class UserLoginDTO(BaseModel):
    """Login request."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User response."""
    id: UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Token response."""
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class CreateArticleDTO(BaseModel):
    """Create article request."""
    title: str = Field(..., min_length=1, max_length=512)
    body: str = Field(default="")


class UpdateArticleDTO(BaseModel):
    """Update article request."""
    title: str | None = None
    body: str | None = None
    scientific_format: ScientificFormat | None = None


class ArticleResponse(BaseModel):
    """Article response."""
    id: UUID
    title: str
    body: str
    status: ArticleStatus
    scientific_format: ScientificFormat
    author_id: UUID
    reviewer_id: UUID | None
    cover_url: str | None
    rejection_comment: str | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None

    class Config:
        from_attributes = True


class ArticleListResponse(BaseModel):
    """List articles response."""
    items: list[ArticleResponse]
    total: int
    page: int
    size: int
    pages: int


# ============ AI DTOs ============


class AIAssistRequest(BaseModel):
    """Request for AI assistance."""
    article_id: UUID
    user_prompt: str = Field(..., min_length=1, max_length=1000)
    selected_text: str | None = None
    article_context: str | None = None


class AIAssistResponse(BaseModel):
    """Response from AI assistance."""
    run_id: UUID
    suggestion: str
    sources: list[dict] = []
    tokens_used: int = 0
    status: str  # "completed" | "fallback" | "failed"


class AIIngestRequest(BaseModel):
    """Request for AI ingest (RAG)."""
    article_id: UUID
    source_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)


class AIFormatRequest(BaseModel):
    """Request for scientific formatting."""
    article_id: UUID
    text: str
    format: ScientificFormat


class AIFormatResponse(BaseModel):
    """Response from formatting."""
    run_id: UUID
    formatted_text: str
    status: str  # "completed" | "failed"
