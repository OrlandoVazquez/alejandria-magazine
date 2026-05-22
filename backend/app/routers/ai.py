"""AI router: Ollama, RAG ingest, formatting."""
from uuid import uuid4, UUID

import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.models import AIAssistRequest, AIAssistResponse, AIIngestRequest, AIFormatRequest, AIFormatResponse, ScientificFormat

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


def _vectorize_text(text: str, dim: int) -> list[float]:
    """Simple deterministic vectorizer for demo RAG (no external embeddings)."""
    buckets = [0.0] * dim
    for i, char in enumerate(text.lower()):
        buckets[(ord(char) + i) % dim] += 1.0

    norm = sum(value * value for value in buckets) ** 0.5
    if norm == 0:
        return buckets
    return [value / norm for value in buckets]


def _chunk_text(text: str, chunk_size: int = 400) -> list[str]:
    """Split text into chunks."""
    clean = " ".join(text.split())
    return [clean[i : i + chunk_size] for i in range(0, len(clean), chunk_size)]


async def _ensure_qdrant_collection() -> None:
    """Ensure Qdrant collection exists."""
    collection = settings.QDRANT_COLLECTION
    try:
        async with httpx.AsyncClient(base_url=settings.QDRANT_URL, timeout=10.0) as client:
            response = await client.get(f"/collections/{collection}")
            if response.status_code == 200:
                return
            if response.status_code != 404:
                raise HTTPException(status_code=502, detail="Qdrant error")

            create_response = await client.put(
                f"/collections/{collection}",
                json={
                    "vectors": {
                        "size": settings.RAG_VECTOR_SIZE,
                        "distance": "Cosine",
                    }
                },
            )
            if create_response.status_code not in (200, 201):
                raise HTTPException(status_code=502, detail="Could not create RAG collection")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Qdrant unavailable")


async def _generate_with_ollama(model: str, query: str, contexts: list[str]) -> str:
    """Generate text using Ollama."""
    context_block = "\n".join(f"- {ctx}" for ctx in contexts) if contexts else "- (no context)"
    prompt = (
        "You are a scientific writing assistant. Use the RAG context to answer briefly.\n\n"
        f"Question:\n{query}\n\n"
        f"RAG Context:\n{context_block}\n\n"
        "Answer:"
    )

    try:
        async with httpx.AsyncClient(base_url=settings.OLLAMA_BASE_URL, timeout=45.0) as client:
            response = await client.post(
                "/api/generate",
                json={"model": model, "prompt": prompt, "stream": False},
            )
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail="Ollama generation failed")
            return response.json().get("response", "").strip()
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Ollama unavailable")


@router.get("/models")
async def list_models():
    """List available local models in Ollama."""
    try:
        async with httpx.AsyncClient(base_url=settings.OLLAMA_BASE_URL, timeout=10.0) as client:
            response = await client.get("/api/tags")
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail="Could not query Ollama models")
            models = response.json().get("models", [])
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Ollama unavailable")

    names = [item.get("name") for item in models if item.get("name")]
    return {"models": names}


@router.post("/assist", response_model=AIAssistResponse)
async def assist(req: AIAssistRequest):
    """AI writing assistance using RAG."""
    await _ensure_qdrant_collection()
    
    # Generate suggestion
    model = settings.OLLAMA_MODEL
    suggestion = await _generate_with_ollama(model, req.user_prompt, [])
    
    return AIAssistResponse(
        run_id=uuid4(),
        suggestion=suggestion,
        sources=[],
        tokens_used=0,
        status="completed"
    )


@router.post("/ingest")
async def ingest(req: AIIngestRequest):
    """Ingest text into RAG (Qdrant)."""
    await _ensure_qdrant_collection()
    
    # Chunk and vectorize
    chunks = _chunk_text(req.text)
    vectors = [_vectorize_text(chunk, settings.RAG_VECTOR_SIZE) for chunk in chunks]
    
    # Upsert to Qdrant
    try:
        async with httpx.AsyncClient(base_url=settings.QDRANT_URL, timeout=10.0) as client:
            points = [
                {
                    "id": str(hash(chunk) % 2**31),
                    "vector": vec,
                    "payload": {
                        "article_id": str(req.article_id),
                        "source_id": req.source_id,
                        "text": chunk
                    }
                }
                for chunk, vec in zip(chunks, vectors)
            ]
            
            response = await client.put(
                f"/collections/{settings.QDRANT_COLLECTION}/points",
                json={"points": points}
            )
            
            if response.status_code not in (200, 201):
                raise HTTPException(status_code=502, detail="Could not upsert to Qdrant")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Qdrant unavailable")
    
    return {"status": "queued", "task_id": str(uuid4())}


@router.post("/format", response_model=AIFormatResponse)
async def format_article(req: AIFormatRequest):
    """Format text to scientific standard (APA, IEEE, Vancouver)."""
    format_instructions = {
        ScientificFormat.APA: "Format text as APA style.",
        ScientificFormat.IEEE: "Format text as IEEE style.",
        ScientificFormat.VANCOUVER: "Format text as Vancouver style.",
        ScientificFormat.NONE: "Keep text as is.",
    }
    
    instruction = format_instructions.get(req.format, "Keep text as is.")
    model = settings.OLLAMA_MODEL
    
    prompt = f"{instruction}\n\nText:\n{req.text}"
    
    try:
        formatted_text = await _generate_with_ollama(model, prompt, [])
    except HTTPException:
        raise
    
    return AIFormatResponse(
        run_id=uuid4(),
        formatted_text=formatted_text,
        status="completed"
    )
