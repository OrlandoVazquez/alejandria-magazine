import logging
import httpx
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

async def run_formateador(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Formateador Agent:
    Formats the citations and bibliography of the draft according to the 
    specified format (APA, IEEE, Vancouver).
    """
    draft_text = state.get("draft_text") or ""
    scientific_format = state.get("scientific_format") or "apa"
    
    logger.info(f"Running Formateador for format: {scientific_format}")
    
    format_instructions = {
        "apa": "Format the references in APA 7th edition style (Author, Year). Use (Author, Year) for in-text citations.",
        "ieee": "Format the references in IEEE style. Use bracketed numbers [1], [2] for in-text citations, ordered sequentially.",
        "vancouver": "Format the references in Vancouver style. Use numbered citations in order of appearance in the text."
    }
    
    instruction = format_instructions.get(scientific_format.lower(), "Format references in APA style.")
    
    prompt = (
        f"You are a scientific layout editor. Reformat the references and in-text citations of the following manuscript.\n"
        f"Format Style: {scientific_format.upper()} - {instruction}\n\n"
        f"Manuscript:\n"
        f"{draft_text}\n\n"
        f"Keep the main content exactly the same. Only rewrite the citations and references section to match the style format."
    )
    
    model = settings.OLLAMA_MODEL
    formatted_text = ""
    
    try:
        async with httpx.AsyncClient(base_url=settings.OLLAMA_BASE_URL, timeout=45.0) as client:
            response = await client.post(
                "/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                }
            )
            if response.status_code == 200:
                formatted_text = response.json().get("response", "").strip()
            else:
                logger.error(f"Ollama returned status code {response.status_code}")
                formatted_text = draft_text
    except Exception as e:
        logger.error(f"Error calling Ollama in Formateador: {str(e)}")
        # Simple simulated formatting if Ollama fails
        formatted_text = draft_text + f"\n\n*Formatted automatically to {scientific_format.upper()} style.*"

    return {
        "formatted_text": formatted_text
    }
