"""Articles router: CRUD and workflow for articles."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ArticleModel, ArticleStatus, CreateArticleDTO, UpdateArticleDTO,
    ArticleResponse, ArticleListResponse
)
from app.database import get_session
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/articles", tags=["articles"])


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    status: ArticleStatus | None = None,
    skip: int = 0,
    limit: int = 100,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """List articles by current user."""
    stmt = select(ArticleModel).where(ArticleModel.author_id == UUID(token_data["user_id"]))
    
    if status:
        stmt = stmt.where(ArticleModel.status == status)
    
    stmt = stmt.offset(skip).limit(limit)
    result = await session.execute(stmt)
    items = result.scalars().all()
    
    # Get total count
    count_stmt = select(ArticleModel).where(ArticleModel.author_id == UUID(token_data["user_id"]))
    count_result = await session.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    return ArticleListResponse(
        items=[ArticleResponse.from_orm(item) for item in items],
        total=total,
        page=skip // limit + 1,
        size=limit,
        pages=(total + limit - 1) // limit
    )


@router.post("", response_model=ArticleResponse, status_code=201)
async def create_article(
    req: CreateArticleDTO,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Create a new article."""
    article = ArticleModel(
        title=req.title,
        body=req.body,
        author_id=UUID(token_data["user_id"])
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    
    return ArticleResponse.from_orm(article)


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    """Get an article by ID."""
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    result = await session.execute(stmt)
    article = result.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return ArticleResponse.from_orm(article)


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: UUID,
    req: UpdateArticleDTO,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Update an article."""
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    result = await session.execute(stmt)
    article = result.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if str(article.author_id) != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if req.title is not None:
        article.title = req.title
    if req.body is not None:
        article.body = req.body
    if req.scientific_format is not None:
        article.scientific_format = req.scientific_format
    
    session.add(article)
    await session.commit()
    await session.refresh(article)
    
    return ArticleResponse.from_orm(article)


@router.post("/{article_id}/submit", response_model=ArticleResponse)
async def submit_for_review(
    article_id: UUID,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Submit article for review (draft → in_review)."""
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    result = await session.execute(stmt)
    article = result.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if str(article.author_id) != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if article.status != ArticleStatus.DRAFT:
        raise HTTPException(status_code=409, detail="Article not in draft status")
    
    article.status = ArticleStatus.IN_REVIEW
    session.add(article)
    await session.commit()
    await session.refresh(article)
    
    return ArticleResponse.from_orm(article)


@router.post("/{article_id}/approve", response_model=ArticleResponse)
async def approve_article(
    article_id: UUID,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Approve article (in_review → approved → published)."""
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    result = await session.execute(stmt)
    article = result.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if article.status != ArticleStatus.IN_REVIEW:
        raise HTTPException(status_code=409, detail="Article not under review")
    
    article.status = ArticleStatus.PUBLISHED
    article.reviewer_id = UUID(token_data["user_id"])
    article.published_at = __import__("datetime").datetime.utcnow()
    
    session.add(article)
    await session.commit()
    await session.refresh(article)
    
    return ArticleResponse.from_orm(article)


@router.post("/{article_id}/reject", response_model=ArticleResponse)
async def reject_article(
    article_id: UUID,
    comment: str,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Reject article (in_review → draft)."""
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    result = await session.execute(stmt)
    article = result.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if article.status != ArticleStatus.IN_REVIEW:
        raise HTTPException(status_code=409, detail="Article not under review")
    
    article.status = ArticleStatus.REJECTED
    article.rejection_comment = comment
    article.reviewer_id = UUID(token_data["user_id"])
    
    session.add(article)
    await session.commit()
    await session.refresh(article)
    
    return ArticleResponse.from_orm(article)
