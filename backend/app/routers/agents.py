"""Agents router: run and monitor agent orchestrations, manage agent prompts."""
import asyncio
import json
import yaml
from uuid import UUID
from pathlib import Path
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ArticleModel, AgentRunModel, AgentRunRequest, 
    AgentRunListResponse, AgentRunDetailResponse
)
from app.database import get_session
from app.routers.auth import get_current_user
from app.core.security import verify_token
from app.agents.orquestador import Orchestrator, active_streams, publish_event

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


def get_claude_agents_dir() -> Path:
    paths = [
        Path(".claude/agents"),
        Path("../.claude/agents"),
        Path("../../.claude/agents"),
    ]
    for p in paths:
        if p.exists() and p.is_dir():
            return p
    # Default to create one in root
    return Path(".claude/agents")


@router.get("/definitions")
async def get_agent_definitions(token_data=Depends(get_current_user)):
    """Get static descriptions of standard system agents."""
    return {
        "investigador": { "id": "investigador", "name": "Investigador", "description": "Busca contexto en Qdrant RAG y APIs científicas." },
        "redactor": { "id": "redactor", "name": "Redactor", "description": "Genera borrador académico en Markdown usando Ollama." },
        "revisor": { "id": "revisor", "name": "Revisor", "description": "Evalúa el borrador con un score 0-100 y genera feedback." },
        "formateador": { "id": "formateador", "name": "Formateador", "description": "Reformatea citas en APA, IEEE o Vancouver." },
        "publicador": { "id": "publicador", "name": "Publicador", "description": "Guarda el artículo final en DB y lo marca como PUBLISHED." }
    }


@router.get("/claude-defs")
async def get_claude_agent_definitions(token_data=Depends(get_current_user)):
    """Retrieve list of custom Claude agents defined in .claude/agents/."""
    agents_dir = get_claude_agents_dir()
    if not agents_dir.exists():
        return []
    
    results = []
    for filepath in agents_dir.glob("*.md"):
        try:
            stem = filepath.stem
            with open(filepath, "r", encoding="utf-8") as f:
                raw = f.read()
            
            frontmatter = {}
            content = raw
            if raw.startswith("---"):
                parts = raw.split("---", 2)
                if len(parts) >= 3:
                    try:
                        frontmatter = yaml.safe_load(parts[1]) or {}
                    except Exception:
                        pass
                    content = parts[2]
            
            results.append({
                "id": stem,
                "name": stem.replace("-", " ").title(),
                "content": content.lstrip(),
                "model": frontmatter.get("model", "llama3.2"),
                "temperature": frontmatter.get("temperature", 0.7),
                "prompt_template": frontmatter.get("prompt_template", ""),
                "rag_enabled": frontmatter.get("rag_enabled", True),
                "rag_collection": frontmatter.get("rag_collection", "rag_docs")
            })
        except Exception:
            pass
            
    return results


@router.put("/claude-defs/{name}")
async def update_claude_agent_definition(
    name: str, 
    payload: dict, 
    token_data=Depends(get_current_user)
):
    """Update custom Claude agent Prompt, Markdown, or parameters."""
    content = payload.get("content", "")
    agents_dir = get_claude_agents_dir()
    if not agents_dir.exists():
        agents_dir.mkdir(parents=True, exist_ok=True)
        
    filepath = agents_dir / f"{name}.md"
    
    is_json = False
    params = {}
    try:
        if content.strip().startswith("{") and content.strip().endswith("}"):
            params = json.loads(content)
            is_json = True
    except Exception:
        pass
        
    if is_json:
        # Update parameters only (keep existing Markdown description)
        existing_md = ""
        existing_frontmatter = {}
        if filepath.exists():
            with open(filepath, "r", encoding="utf-8") as f:
                raw = f.read()
            if raw.startswith("---"):
                parts = raw.split("---", 2)
                if len(parts) >= 3:
                    try:
                        existing_frontmatter = yaml.safe_load(parts[1]) or {}
                    except Exception:
                        pass
                    existing_md = parts[2]
                else:
                    existing_md = raw
            else:
                existing_md = raw
                
        existing_frontmatter.update(params)
        
        new_content = "---\n" + yaml.safe_dump(existing_frontmatter, default_flow_style=False, sort_keys=False) + "---\n" + existing_md
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
    else:
        # Overwrite entire file with Markdown
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
    return {"status": "success", "message": f"Agent {name} updated successfully"}


@router.post("/{article_id}/run")
async def run_agent_pipeline(
    article_id: UUID,
    req: AgentRunRequest,
    background_tasks: BackgroundTasks,
    token_data=Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Run the multi-agent pipeline on a specific article in the background.
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
    
    # Run Orchestrator flow as a background task to allow SSE to immediately stream
    background_tasks.add_task(
        Orchestrator.run,
        article_id=article_id,
        author_id=article.author_id,
        title=title,
        keywords=keywords,
        scientific_format=scientific_format,
        flow_sequence=req.flow_sequence
    )
    
    return {"status": "accepted", "message": "Agent execution pipeline started"}


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
        runs=[AgentRunDetailResponse.model_validate(r) for r in runs]
    )


@router.get("/{article_id}/stream")
async def stream_agent_runs(
    article_id: UUID,
    token: str | None = None,
    session: AsyncSession = Depends(get_session)
):
    """SSE endpoint for real-time monitoring of active agent runs."""
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    token_data = verify_token(token)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    # Verify ownership of the article
    stmt = select(ArticleModel).where(ArticleModel.id == article_id)
    res = await session.execute(stmt)
    article = res.scalars().first()
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if str(article.author_id) != token_data["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    q = asyncio.Queue()
    if article_id not in active_streams:
        active_streams[article_id] = []
    active_streams[article_id].append(q)

    async def event_generator():
        try:
            while True:
                # Wait for an event from active_streams
                event = await q.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") == "done":
                    break
        except asyncio.CancelledError:
            # client disconnected
            pass
        finally:
            if article_id in active_streams:
                if q in active_streams[article_id]:
                    active_streams[article_id].remove(q)
                if not active_streams[article_id]:
                    del active_streams[article_id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")
