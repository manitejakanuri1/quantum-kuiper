"""
RAG Query API - LLM-Free Backend
FastAPI endpoints for the frontend to query the RAG system

CRITICAL RULES:
1. Similarity threshold enforcement - minimum score required or fallback
2. Agent isolation - every query scoped by agent_id
3. Text-only responses - server.ts handles FishAudio/avatar sync
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import random

from supabase_client import get_supabase_client, find_best_answer

app = FastAPI(
    title="RAG Query API",
    version="2.0.0",
    description="LLM-Free RAG Backend - Text responses only, TTS handled by server.ts"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# CONFIGURATION - CRITICAL THRESHOLDS
# ==============================================================================

# Minimum similarity score required to return an answer
# Below this threshold, we use fallback response instead of wrong answer
SIMILARITY_THRESHOLD = 0.3  # 30% minimum match required

# Fallback responses when no match found OR similarity too low
FALLBACK_RESPONSES = [
    "I don't have specific information about that. Would you like me to help with something else?",
    "I'm not sure about that particular question. Is there something else I can help you with?",
    "That's not something I have information on. Feel free to ask about our services or hours."
]


# ==============================================================================
# REQUEST/RESPONSE MODELS
# ==============================================================================

class QueryRequest(BaseModel):
    query: str
    agent_id: str  # REQUIRED - enforces agent isolation


class QueryResponse(BaseModel):
    text: str                           # The response text (verbatim from DB or fallback)
    question_matched: Optional[str]     # The question that was matched (if any)
    similarity: float                   # Similarity score (0.0 - 1.0)
    found: bool                         # True if good match found, False if fallback used
    threshold_met: bool                 # True if similarity >= SIMILARITY_THRESHOLD


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "rag-api",
        "version": "2.0.0",
        "similarity_threshold": SIMILARITY_THRESHOLD,
        "note": "Text responses only - TTS handled by server.ts"
    }


@app.post("/api/query", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    """
    Query the RAG system for an answer.
    
    RULES ENFORCED:
    1. Agent isolation via agent_id (required)
    2. Similarity threshold - below threshold returns fallback
    3. Returns TEXT ONLY - server.ts handles FishAudio
    
    Returns the exact stored response (no LLM modification).
    """
    # Validate agent_id is provided (agent isolation)
    if not request.agent_id or request.agent_id.strip() == "":
        raise HTTPException(
            status_code=400,
            detail="agent_id is required for agent isolation"
        )
    
    try:
        client = get_supabase_client()
        result = find_best_answer(client, request.agent_id, request.query)
        
        # Check if we got a result
        if result:
            similarity = float(result.get('similarity', 0) or 0)
            
            # CRITICAL: Check similarity threshold
            if similarity >= SIMILARITY_THRESHOLD:
                # Good match - return stored response verbatim
                response_text = result.get('spoken_response') or result.get('content', '')
                
                if response_text:
                    return QueryResponse(
                        text=response_text,
                        question_matched=result.get('question'),
                        similarity=similarity,
                        found=True,
                        threshold_met=True
                    )
            
            # Similarity too low - use fallback
            return QueryResponse(
                text=random.choice(FALLBACK_RESPONSES),
                question_matched=result.get('question'),  # Still show what was matched
                similarity=similarity,
                found=False,
                threshold_met=False
            )
        
        # No result at all - use fallback
        return QueryResponse(
            text=random.choice(FALLBACK_RESPONSES),
            question_matched=None,
            similarity=0.0,
            found=False,
            threshold_met=False
        )
            
    except Exception as e:
        print(f"[RAG] Error querying for agent {request.agent_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    """Get current RAG configuration"""
    return {
        "similarity_threshold": SIMILARITY_THRESHOLD,
        "fallback_count": len(FALLBACK_RESPONSES),
        "tts_note": "TTS is NOT handled by this API. server.ts calls FishAudio."
    }


# ==============================================================================
# CRAWLING & Q&A MANAGEMENT ENDPOINTS
# ==============================================================================

from crawler import crawl_and_store, save_qa_to_supabase, get_crawl_summary
from supabase_client import (
    get_or_create_knowledge_base, 
    save_curated_qa, 
    update_kb_status,
    get_supabase_client,
    save_website_data,
    get_website_data
)
from typing import List


class CrawlRequest(BaseModel):
    url: str
    agent_id: str
    max_pages: int = 5


class CrawlResponse(BaseModel):
    success: bool
    kb_id: str
    pages_crawled: int
    pages_saved: int
    qa_suggestions: List[dict]
    message: str


class QAPair(BaseModel):
    question: str
    spoken_response: str
    keywords: List[str]
    priority: int = 5


class SaveQARequest(BaseModel):
    agent_id: str
    qa_pairs: List[QAPair]


class GetQAResponse(BaseModel):
    agent_id: str
    qa_pairs: List[dict]
    total: int


@app.post("/api/crawl", response_model=CrawlResponse)
async def crawl_website_endpoint(request: CrawlRequest):
    """
    Crawl a website and store ALL data directly in Supabase.
    
    This endpoint:
    1. Creates/gets knowledge_base row for this agent
    2. Crawls the website (up to max_pages)
    3. Stores each page in website_data table
    4. Returns Q&A suggestions for admin curation
    
    NO FILES ARE CREATED - everything goes to Supabase.
    """
    try:
        print(f"[API] Crawl request: {request.url} for agent {request.agent_id}")
        
        # Use the new crawl_and_store function that writes directly to Supabase
        kb_id, pages_crawled, pages_saved, qa_suggestions = crawl_and_store(
            agent_id=request.agent_id,
            website_url=request.url,
            max_pages=request.max_pages
        )
        
        if pages_crawled == 0:
            return CrawlResponse(
                success=False,
                kb_id="",
                pages_crawled=0,
                pages_saved=0,
                qa_suggestions=[],
                message="Failed to crawl website. Please check the URL."
            )
        
        return CrawlResponse(
            success=True,
            kb_id=kb_id,
            pages_crawled=pages_crawled,
            pages_saved=pages_saved,
            qa_suggestions=qa_suggestions,
            message=f"Successfully crawled {pages_crawled} pages and saved {pages_saved} to Supabase."
        )
        
    except Exception as e:
        print(f"[Crawl] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/qa/save")
async def save_qa_pairs(request: SaveQARequest):
    """
    Save curated Q&A pairs to Supabase.
    Called after admin reviews and approves the Q&A pairs.
    """
    try:
        client = get_supabase_client()
        
        # Get or create knowledge base
        kb_id = get_or_create_knowledge_base(client, request.agent_id, "curated")
        
        saved_count = 0
        for qa in request.qa_pairs:
            save_curated_qa(
                client,
                kb_id,
                question=qa.question,
                spoken_response=qa.spoken_response,
                keywords=qa.keywords,
                priority=qa.priority
            )
            saved_count += 1
        
        # Mark knowledge base as ready
        update_kb_status(client, kb_id, 'ready')
        
        print(f"[QA] Saved {saved_count} Q&A pairs for agent {request.agent_id}")
        
        return {
            "success": True,
            "saved_count": saved_count,
            "agent_id": request.agent_id,
            "kb_id": kb_id
        }
        
    except Exception as e:
        print(f"[QA] Save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/qa/{agent_id}")
async def get_qa_pairs(agent_id: str):
    """
    Get all Q&A pairs for an agent.
    Used by admin to review existing Q&A data.
    """
    try:
        client = get_supabase_client()
        
        # Get knowledge base for this agent
        kb_result = client.table('knowledge_bases').select('id').eq('agent_id', agent_id).execute()
        
        if not kb_result.data:
            return {"agent_id": agent_id, "qa_pairs": [], "total": 0}
        
        kb_id = kb_result.data[0]['id']
        
        # Get all Q&A pairs
        qa_result = client.table('document_chunks').select(
            'id, question, spoken_response, keywords, priority'
        ).eq('kb_id', kb_id).not_.is_('question', 'null').order('priority', desc=True).execute()
        
        return {
            "agent_id": agent_id,
            "qa_pairs": qa_result.data or [],
            "total": len(qa_result.data) if qa_result.data else 0
        }
        
    except Exception as e:
        print(f"[QA] Get error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/qa/{agent_id}/{qa_id}")
async def delete_qa_pair(agent_id: str, qa_id: str):
    """Delete a specific Q&A pair"""
    try:
        client = get_supabase_client()
        client.table('document_chunks').delete().eq('id', qa_id).execute()
        return {"success": True, "deleted_id": qa_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents")
async def get_agents():
    """Get all available agents"""
    try:
        client = get_supabase_client()
        result = client.table('agents').select('id, name, website_url, status').execute()
        return {"agents": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# WEBSITE DATA ENDPOINTS
# ==============================================================================

@app.get("/api/website-data/{agent_id}")
async def get_agent_website_data(agent_id: str):
    """Get all stored website data for an agent"""
    try:
        client = get_supabase_client()
        data = get_website_data(client, agent_id)
        return {
            "agent_id": agent_id,
            "website_data": data,
            "total": len(data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/website-data/{agent_id}/{data_id}")
async def delete_agent_website_data(agent_id: str, data_id: str):
    """Delete specific website data entry"""
    try:
        from supabase_client import delete_website_data
        client = get_supabase_client()
        delete_website_data(client, data_id)
        return {"success": True, "deleted_id": data_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# SERVER STARTUP
# ==============================================================================

if __name__ == "__main__":
    print("""
╔════════════════════════════════════════════════════════════╗
║              RAG Query API - LLM-Free Backend              ║
╠════════════════════════════════════════════════════════════╣
║  CRITICAL RULES:                                           ║
║  1. Similarity threshold: {:.0%} minimum                     ║
║  2. Agent isolation: agent_id required                     ║
║  3. Text only: server.ts handles FishAudio TTS             ║
║                                                            ║
║  ENDPOINTS:                                                ║
║  - POST /api/query      - Query RAG system                 ║
║  - POST /api/crawl      - Crawl website                    ║
║  - POST /api/qa/save    - Save Q&A pairs                   ║
║  - GET  /api/qa/:id     - Get agent's Q&A pairs            ║
║  - GET  /api/agents     - List all agents                  ║
╚════════════════════════════════════════════════════════════╝
    """.format(SIMILARITY_THRESHOLD))
    uvicorn.run(app, host="0.0.0.0", port=8000)
