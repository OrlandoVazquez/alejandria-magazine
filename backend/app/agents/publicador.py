import logging
import datetime
from typing import Dict, Any
from sqlalchemy import select
from app.shared.database import AsyncSessionLocal
from app.models import ArticleModel, ArticleStatus

logger = logging.getLogger(__name__)

async def run_publicador(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Publicador Agent:
    Congests final text, updates DB record to PUBLISHED, and generates
    indexing metadata and published URL.
    """
    article_id = state.get("article_id")
    final_text = state.get("formatted_text") or state.get("draft_text") or ""
    
    logger.info(f"Running Publicador for article: {article_id}")
    
    word_count = len(final_text.split())
    metadata = {
        "indexed": True,
        "publisher": "AlexandrIA Magazine Editorial",
        "license": "CC-BY-4.0",
        "word_count": word_count,
        "reading_time_minutes": max(1, word_count // 200),
        "indexing_timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    published_url = f"http://localhost:8080/articles/{article_id}/view"
    
    try:
        # Update article status to published and body to final formatted text
        async with AsyncSessionLocal() as session:
            stmt = select(ArticleModel).where(ArticleModel.id == article_id)
            result = await session.execute(stmt)
            article = result.scalars().first()
            if article:
                article.body = final_text
                article.status = ArticleStatus.PUBLISHED
                article.published_at = datetime.datetime.utcnow()
                session.add(article)
                await session.commit()
                logger.info(f"Article {article_id} successfully marked as PUBLISHED in DB")
            else:
                logger.error(f"Article {article_id} not found in DB during publishing")
    except Exception as e:
        logger.error(f"Error updating article to PUBLISHED in DB: {str(e)}")

    return {
        "published_url": published_url,
        "metadata": metadata
    }
