"""Agents router: run and monitor agent orchestrations."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ArticleModel, AgentRunModel, AgentRunRequest, 
    AgentRunListResponse, AgentRunDetailResponse
)
from app.database import get_session
from app.routers.auth import get_current_user
from app.agents.orquestador import Orchestrator

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


@router.post("/{article_id}/run")
async def run_agent_pipeline(
    article_id: UUID,
    req: AgentRunRequest,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Run the multi-agent pipeline on a specific article.
    Compiles and executes LangGraph nodes in the requested flow sequence.
    """
    # Verify article exists and belongs to the authenticated author
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    res = await session.execute(stmt)
    article = res.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
        
    if str(article.author_id) != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this article")
        
    # Extract keywords from title for research context
    title = article.title
    keywords = [w.strip(".,;:?!") for w in title.lower().split() if len(w) > 4]
    if not keywords:
        keywords = ["scientific", "research"]
        
    scientific_format = article.scientific_format.value if article.scientific_format else "apa"
    
    try:
        final_state = await Orchestrator.run(
            article_id=article_id,
            author_id=article.author_id,
            title=title,
            keywords=keywords,
            scientific_format=scientific_format,
            flow_sequence=req.flow_sequence
        )
        
        # Determine final word count
        final_body = final_state.get("formatted_text") or final_state.get("draft_text") or ""
        word_count = len(final_body.split())
        
        return {
            "status": "completed",
            "published_url": final_state.get("published_url"),
            "feedback": final_state.get("feedback", []),
            "approval_score": final_state.get("approval_score", 100.0),
            "word_count": word_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {str(e)}")


@router.get("/{article_id}/runs", response_model=AgentRunListResponse)
async def get_article_agent_runs(
    article_id: UUID,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Retrieve history logs of agent executions for a specific article.
    """
    # Verify ownership of the article
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    res = await session.execute(stmt)
    article = res.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
        
    if str(article.author_id) != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this article")
        
    # Query agent execution history
    stmt_runs = select(AgentRunModel).where(AgentRunModel.article_id == article_id).order_by(AgentRunModel.started_at.desc())
    res_runs = await session.execute(stmt_runs)
    runs = res_runs.scalars().all()
    
    return AgentRunListResponse(
        runs=[AgentRunDetailResponse.from_orm(r) for r in runs]
    )
