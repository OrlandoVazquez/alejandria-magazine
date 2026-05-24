import logging
import httpx
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

async def run_investigador(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Investigador Agent:
    Searches RAG (Qdrant) and public scientific databases (EuropePMC/OpenAlex) 
    for keywords to build the research context.
    """
    article_id = state.get("article_id")
    keywords = state.get("keywords") or []
    
    logger.info(f"Running Investigador for article {article_id} with keywords {keywords}")
    
    query_str = " ".join(keywords) if keywords else "scientific research"
    sources = []
    research_chunks = []
    
    # 1. Query local RAG (Qdrant) if configured and running
    try:
        async with httpx.AsyncClient(base_url=settings.QDRANT_URL, timeout=5.0) as client:
            # Scroll points for this article_id
            filter_payload = {
                "filter": {
                    "must": [
                        {
                            "key": "article_id",
                            "match": {"value": str(article_id)}
                        }
                    ]
                },
                "limit": 5,
                "with_payload": True
            }
            response = await client.post(
                f"/collections/{settings.QDRANT_COLLECTION}/points/scroll",
                json=filter_payload
            )
            if response.status_code == 200:
                points = response.json().get("result", {}).get("points", [])
                for p in points:
                    payload = p.get("payload", {})
                    text = payload.get("text")
                    source_id = payload.get("source_id", "local_rag")
                    if text:
                        research_chunks.append(f"[RAG Source: {source_id}] {text}")
                        sources.append({
                            "title": f"Local Document Chunk ({source_id})",
                            "url": f"local://{source_id}",
                            "snippet": text[:200]
                        })
    except Exception as e:
        logger.warning(f"Could not search Qdrant: {str(e)}")

    # 2. Query EuropePMC Public API for actual papers
    if len(sources) < 3:
        try:
            url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/search"
            params = {
                "query": query_str,
                "format": "json",
                "pageSize": 3
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    results = res.json().get("resultList", {}).get("result", [])
                    for paper in results:
                        title = paper.get("title", "Untitled Paper")
                        author_string = paper.get("authorString", "Unknown Authors")
                        journal = paper.get("journalTitle", "Unknown Journal")
                        pub_year = paper.get("pubYear", "N/A")
                        doi = paper.get("doi")
                        abstract = paper.get("abstractText", "No abstract available.")
                        
                        paper_url = f"https://doi.org/{doi}" if doi else "https://europepmc.org"
                        snippet = f"Abstract: {abstract[:300]}..."
                        
                        research_chunks.append(
                            f"Paper: {title}\nAuthors: {author_string}\nJournal: {journal} ({pub_year})\n{snippet}"
                        )
                        sources.append({
                            "title": f"{title} ({pub_year})",
                            "url": paper_url,
                            "snippet": abstract[:200]
                        })
        except Exception as e:
            logger.warning(f"Could not search EuropePMC: {str(e)}")
            
    # 3. Fallback to mock data if absolutely nothing was found
    if not sources:
        logger.info("Using simulated scientific literature fallback data.")
        mock_papers = [
            {
                "title": f"Advancements in agentic writing using Local LLMs on {query_str}",
                "url": "https://example.org/mock-paper-1",
                "snippet": "This study analyzes how local deployment of models like Llama 3.2 can automate scientific formatting and peer review processes with low latency."
            },
            {
                "title": f"A comprehensive review of RAG architectures and vector storage",
                "url": "https://example.org/mock-paper-2",
                "snippet": "We evaluate Qdrant and other dedicated vector stores for real-time document chunking and metadata filtering in agentic orchestrations."
            }
        ]
        for paper in mock_papers:
            sources.append(paper)
            research_chunks.append(f"Simulated Paper: {paper['title']}\n{paper['snippet']}")

    research_data = "\n\n---\n\n".join(research_chunks)
    
    return {
        "research_data": research_data,
        "sources": sources
    }
