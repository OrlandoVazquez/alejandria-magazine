import logging
import datetime
import uuid
from typing import Dict, Any, List, TypedDict
from sqlalchemy import select

from langgraph.graph import StateGraph, START, END

from app.shared.database import AsyncSessionLocal
from app.models import AgentRunModel

# Import agent runner functions
from app.agents.investigador import run_investigador
from app.agents.redactor import run_redactor
from app.agents.revisor import run_revisor
from app.agents.formateador import run_formateador
from app.agents.publicador import run_publicador

logger = logging.getLogger(__name__)

# Define State Schema
class AgentState(TypedDict):
    article_id: uuid.UUID
    author_id: uuid.UUID
    title: str
    keywords: List[str]
    research_data: str
    sources: List[Dict[str, Any]]
    draft_text: str
    feedback: List[str]
    approval_score: float
    formatted_text: str
    scientific_format: str
    published_url: str
    metadata: Dict[str, Any]
    flow_sequence: List[str]
    current_step_index: int
    loop_count: int

# DB Logger Helpers
async def log_run_start(agent_name: str, article_id: uuid.UUID, author_id: uuid.UUID, input_payload: dict) -> uuid.UUID:
    try:
        async with AsyncSessionLocal() as session:
            run = AgentRunModel(
                agent_name=agent_name,
                article_id=article_id,
                author_id=author_id,
                status="running",
                input_payload=input_payload,
                started_at=datetime.datetime.utcnow()
            )
            session.add(run)
            await session.commit()
            await session.refresh(run)
            return run.run_id
    except Exception as e:
        logger.error(f"Error logging run start for {agent_name}: {str(e)}")
        return uuid.uuid4()

async def log_run_end(run_id: uuid.UUID, output_payload: dict, status: str, error_message: str = None) -> None:
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(AgentRunModel).where(AgentRunModel.run_id == run_id)
            res = await session.execute(stmt)
            run = res.scalars().first()
            if run:
                run.output_payload = output_payload or {}
                run.status = status
                run.error_message = error_message
                run.finished_at = datetime.datetime.utcnow()
                session.add(run)
                await session.commit()
    except Exception as e:
        logger.error(f"Error logging run end for run {run_id}: {str(e)}")

# Global registry for active SSE streams: article_id -> list of asyncio.Queue
import asyncio
active_streams = {}

def publish_event(article_id: uuid.UUID, event: dict):
    if article_id in active_streams:
        for q in active_streams[article_id]:
            try:
                q.put_nowait(event)
            except Exception:
                pass

# Node Wrapper Factory
def make_node_wrapper(agent_name: str, run_fn):
    async def wrapper(state: AgentState) -> Dict[str, Any]:
        article_id = state.get("article_id")
        author_id = state.get("author_id")
        
        # Prepare input data for logging
        input_data = {
            "title": state.get("title"),
            "keywords": state.get("keywords"),
            "scientific_format": state.get("scientific_format"),
            "current_step_index": state.get("current_step_index", 0),
            "loop_count": state.get("loop_count", 0)
        }
        
        # Emit start event to active streams
        publish_event(article_id, {"type": "agent_start", "agent": agent_name})
        publish_event(article_id, {"type": "log", "message": f"Agent {agent_name} started execution."})
        
        run_id = await log_run_start(agent_name, article_id, author_id, input_data)
        
        try:
            res = await run_fn(state)
            await log_run_end(run_id, res, "completed")
            
            # Emit end event with payload
            draft_text = res.get("draft_text")
            formatted_text = res.get("formatted_text")
            end_event = {
                "type": "agent_end",
                "agent": agent_name,
                "output": res
            }
            if draft_text:
                end_event["draft_text"] = draft_text
            if formatted_text:
                end_event["formatted_text"] = formatted_text
                
            publish_event(article_id, end_event)
            publish_event(article_id, {"type": "log", "message": f"Agent {agent_name} completed execution."})
            
            # Increment step index
            res["current_step_index"] = state.get("current_step_index", 0) + 1
            return res
        except Exception as e:
            logger.error(f"Error executing agent {agent_name}: {str(e)}")
            await log_run_end(run_id, {}, "failed", error_message=str(e))
            
            # Emit error event
            publish_event(article_id, {
                "type": "agent_error",
                "agent": agent_name,
                "error": str(e)
            })
            publish_event(article_id, {"type": "log", "message": f"Agent {agent_name} failed: {str(e)}"})
            raise e
            
    return wrapper


# Conditional router function after Revisor
def route_after_revisor(state: AgentState) -> str:
    approval_score = state.get("approval_score", 100)
    loop_count = state.get("loop_count", 0)
    flow = state.get("flow_sequence", [])
    
    # If score is low and loop count < 3, and redactor is in sequence, loop back
    if approval_score < 80 and loop_count < 3 and "redactor" in flow:
        logger.info(f"Revisor score {approval_score} is low. Routing back to 'redactor'. Loop count: {loop_count}")
        return "redactor"
        
    current_idx = state.get("current_step_index", 0)
    if current_idx < len(flow):
        next_node = flow[current_idx]
        logger.info(f"Revisor approved ({approval_score}). Routing to next node in flow: '{next_node}'")
        return next_node
        
    logger.info("Revisor approved and end of flow reached. Routing to END.")
    return "__end__"


class Orchestrator:
    @staticmethod
    def compile_graph(flow_sequence: List[str]) -> Any:
        """
        Dynamically builds and compiles the StateGraph based on the requested flow_sequence.
        """
        if not flow_sequence:
            raise ValueError("flow_sequence cannot be empty")
            
        workflow = StateGraph(AgentState)
        
        # Define agent mapping
        agents_map = {
            "investigador": make_node_wrapper("investigador", run_investigador),
            "redactor": make_node_wrapper("redactor", run_redactor),
            "revisor": make_node_wrapper("revisor", run_revisor),
            "formateador": make_node_wrapper("formateador", run_formateador),
            "publicador": make_node_wrapper("publicador", run_publicador)
        }
        
        # 1. Add nodes that are present in the flow sequence
        # We always add redactor if revisor is present (in case of loop back)
        nodes_to_add = set(flow_sequence)
        if "revisor" in nodes_to_add:
            nodes_to_add.add("redactor")
            
        for node_name in nodes_to_add:
            if node_name in agents_map:
                workflow.add_node(node_name, agents_map[node_name])
            else:
                raise ValueError(f"Unknown agent name: {node_name}")
                
        # 2. Build edges dynamically
        # START connects to the first node in flow_sequence
        workflow.add_edge(START, flow_sequence[0])
        
        # Connect nodes in sequence
        for i, node_name in enumerate(flow_sequence):
            is_last = (i == len(flow_sequence) - 1)
            
            if node_name == "revisor":
                # Revisor has conditional routing
                path_map = {
                    "redactor": "redactor",
                    "__end__": END
                }
                for n in flow_sequence:
                    path_map[n] = n
                workflow.add_conditional_edges("revisor", route_after_revisor, path_map)

            else:
                if is_last:
                    # Connect last node directly to END
                    workflow.add_edge(node_name, END)
                else:
                    # Connect to the next node in flow_sequence
                    next_node = flow_sequence[i + 1]
                    workflow.add_edge(node_name, next_node)
                    
        return workflow.compile()

    @classmethod
    async def run(cls, article_id: uuid.UUID, author_id: uuid.UUID, title: str, keywords: List[str], scientific_format: str, flow_sequence: List[str]) -> Dict[str, Any]:
        """
        Executes the compiled LangGraph flow.
        """
        compiled_graph = cls.compile_graph(flow_sequence)
        
        # Initialize default State
        initial_state = AgentState(
            article_id=article_id,
            author_id=author_id,
            title=title,
            keywords=keywords,
            research_data="",
            sources=[],
            draft_text="",
            feedback=[],
            approval_score=100.0,
            formatted_text="",
            scientific_format=scientific_format,
            published_url="",
            metadata={},
            flow_sequence=flow_sequence,
            current_step_index=0,
            loop_count=0
        )
        
        logger.info(f"Starting LangGraph run for article {article_id} with sequence {flow_sequence}")
        try:
            final_state = await compiled_graph.ainvoke(initial_state)
            return final_state
        finally:
            publish_event(article_id, {"type": "done"})
            logger.info(f"Completed LangGraph run for article {article_id}")
