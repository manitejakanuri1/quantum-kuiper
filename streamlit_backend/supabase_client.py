"""
Supabase Client for RAG System
Handles all database operations for curated Q&A pairs
"""

import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from project root
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if not url or not key:
        raise ValueError("Supabase URL and Key must be set in environment variables")
    
    return create_client(url, key)


def get_or_create_knowledge_base(client: Client, agent_id: str, source_url: str) -> str:
    """Get existing or create new knowledge base for an agent"""
    # Check if knowledge base exists
    result = client.table('knowledge_bases').select('id').eq('agent_id', agent_id).execute()
    
    if result.data:
        return result.data[0]['id']
    
    # Create new knowledge base
    import uuid
    kb_id = str(uuid.uuid4())
    client.table('knowledge_bases').insert({
        'id': kb_id,
        'agent_id': agent_id,
        'source_url': source_url,
        'status': 'processing'
    }).execute()
    
    return kb_id


def save_curated_qa(
    client: Client,
    kb_id: str,
    question: str,
    spoken_response: str,
    keywords: List[str],
    source_content: Optional[str] = None,
    priority: int = 0
) -> Dict[str, Any]:
    """Save a curated Q&A pair to the database"""
    import uuid
    
    chunk_id = str(uuid.uuid4())
    
    result = client.table('document_chunks').insert({
        'id': chunk_id,
        'kb_id': kb_id,
        'question': question,
        'spoken_response': spoken_response,
        'content': source_content or spoken_response,
        'keywords': keywords,
        'priority': priority,
        'metadata': {'curated': True}
    }).execute()
    
    return result.data[0] if result.data else {'id': chunk_id}


def get_all_qa_pairs(client: Client, agent_id: str) -> List[Dict[str, Any]]:
    """Get all Q&A pairs for an agent"""
    result = client.table('document_chunks').select(
        'id, question, spoken_response, keywords, priority, created_at'
    ).eq(
        'kb_id', 
        client.table('knowledge_bases').select('id').eq('agent_id', agent_id).execute().data[0]['id'] if client.table('knowledge_bases').select('id').eq('agent_id', agent_id).execute().data else ''
    ).order('priority', desc=True).execute()
    
    return result.data if result.data else []


def find_best_answer(client: Client, agent_id: str, user_query: str) -> Optional[Dict[str, Any]]:
    """Find the best matching answer for a user query"""
    result = client.rpc('find_best_answer', {
        'user_query': user_query,
        'p_agent_id': agent_id
    }).execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def delete_qa_pair(client: Client, chunk_id: str) -> bool:
    """Delete a Q&A pair"""
    result = client.table('document_chunks').delete().eq('id', chunk_id).execute()
    return True


def update_qa_pair(
    client: Client,
    chunk_id: str,
    question: Optional[str] = None,
    spoken_response: Optional[str] = None,
    keywords: Optional[List[str]] = None,
    priority: Optional[int] = None
) -> Dict[str, Any]:
    """Update an existing Q&A pair"""
    updates = {}
    if question is not None:
        updates['question'] = question
    if spoken_response is not None:
        updates['spoken_response'] = spoken_response
        updates['content'] = spoken_response
    if keywords is not None:
        updates['keywords'] = keywords
    if priority is not None:
        updates['priority'] = priority
    
    result = client.table('document_chunks').update(updates).eq('id', chunk_id).execute()
    return result.data[0] if result.data else {}


def get_agents(client: Client) -> List[Dict[str, Any]]:
    """Get all agents"""
    result = client.table('agents').select('id, name, website_url').execute()
    return result.data if result.data else []


def update_kb_status(client: Client, kb_id: str, status: str) -> None:
    """Update knowledge base status"""
    client.table('knowledge_bases').update({'status': status}).eq('id', kb_id).execute()


# ==============================================================================
# WEBSITE DATA FUNCTIONS - Store all crawled content in one table
# ==============================================================================

def save_website_data(
    client: Client,
    agent_id: str,
    url: str,
    page_title: str,
    content: str,
    headings: List[str] = None,
    links: List[str] = None,
    metadata: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Save crawled website data to the website_data table.
    Uses upsert - updates if URL already exists for this agent.
    """
    import uuid
    
    try:
        # Try to use RPC function if available
        result = client.rpc('upsert_website_data', {
            'p_agent_id': agent_id,
            'p_url': url,
            'p_page_title': page_title,
            'p_content': content,
            'p_headings': headings or [],
            'p_links': links or [],
            'p_metadata': metadata or {}
        }).execute()
        
        return {'id': result.data, 'success': True}
    except Exception as e:
        # Fallback to direct insert/update
        print(f"[DB] RPC not available, using direct insert: {e}")
        
        # Check if exists
        existing = client.table('website_data').select('id').eq('agent_id', agent_id).eq('url', url).execute()
        
        data = {
            'agent_id': agent_id,
            'url': url,
            'page_title': page_title,
            'content': content,
            'headings': headings or [],
            'links': links or [],
            'metadata': metadata or {},
            'status': 'pending'
        }
        
        if existing.data:
            # Update
            result = client.table('website_data').update(data).eq('id', existing.data[0]['id']).execute()
            return {'id': existing.data[0]['id'], 'success': True, 'action': 'updated'}
        else:
            # Insert
            data['id'] = str(uuid.uuid4())
            result = client.table('website_data').insert(data).execute()
            return {'id': data['id'], 'success': True, 'action': 'inserted'}


def get_website_data(client: Client, agent_id: str) -> List[Dict[str, Any]]:
    """Get all crawled website data for an agent"""
    result = client.table('website_data').select(
        'id, url, page_title, content, headings, crawled_at, status'
    ).eq('agent_id', agent_id).order('crawled_at', desc=True).execute()
    
    return result.data if result.data else []


def get_website_data_by_id(client: Client, data_id: str) -> Optional[Dict[str, Any]]:
    """Get specific website data by ID"""
    result = client.table('website_data').select('*').eq('id', data_id).execute()
    return result.data[0] if result.data else None


def update_website_status(client: Client, data_id: str, status: str) -> None:
    """Update website data status (pending/processed/ready)"""
    client.table('website_data').update({'status': status}).eq('id', data_id).execute()


def delete_website_data(client: Client, data_id: str) -> bool:
    """Delete website data entry"""
    client.table('website_data').delete().eq('id', data_id).execute()
    return True

