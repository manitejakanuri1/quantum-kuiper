"""
Web Crawler for RAG System
Extracts content from websites and stores DIRECTLY in Supabase.

SINGLE SOURCE OF TRUTH:
- One website → one knowledge_base row
- Multiple Q&A → multiple document_chunks rows
- NO files, NO pages, NO filesystem storage
"""

import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Tuple
from urllib.parse import urljoin, urlparse
import re
import uuid

from supabase_client import (
    get_supabase_client,
    get_or_create_knowledge_base,
    save_curated_qa,
    update_kb_status,
    save_website_data
)


def clean_text(text: str) -> str:
    """Clean extracted text"""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters but keep punctuation
    text = re.sub(r'[^\w\s.,!?;:\'-]', '', text)
    return text.strip()


def extract_page_content(url: str) -> Dict[str, any]:
    """Extract content from a single page"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe']):
            element.decompose()
        
        # Extract title
        title = soup.title.string if soup.title else ''
        title = clean_text(title) if title else 'Untitled'
        
        # Extract main content
        content_areas = []
        
        # Priority selectors for main content
        selectors = ['main', 'article', '[role="main"]', '.content', '#content', '.main-content']
        
        for selector in selectors:
            elements = soup.select(selector)
            for elem in elements:
                text = clean_text(elem.get_text())
                if len(text) > 100:
                    content_areas.append(text)
        
        # Fallback to body
        if not content_areas:
            body = soup.find('body')
            if body:
                content_areas.append(clean_text(body.get_text()))
        
        # Extract headings for context
        headings = []
        for h in soup.find_all(['h1', 'h2', 'h3']):
            heading_text = clean_text(h.get_text())
            if heading_text and len(heading_text) > 3:
                headings.append(heading_text)
        
        # Extract lists (often contain service info)
        lists = []
        for ul in soup.find_all(['ul', 'ol']):
            items = [clean_text(li.get_text()) for li in ul.find_all('li')]
            lists.extend([item for item in items if len(item) > 10])
        
        # Extract contact info
        contact_patterns = {
            'phone': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        }
        
        full_text = ' '.join(content_areas)
        contacts = {}
        for key, pattern in contact_patterns.items():
            matches = re.findall(pattern, full_text)
            if matches:
                contacts[key] = list(set(matches))
        
        # Get internal links for further crawling
        internal_links = []
        base_domain = urlparse(url).netloc
        for link in soup.find_all('a', href=True):
            href = link['href']
            full_url = urljoin(url, href)
            if urlparse(full_url).netloc == base_domain:
                if full_url not in internal_links and '#' not in full_url:
                    internal_links.append(full_url)
        
        return {
            'url': url,
            'title': title,
            'content': full_text[:10000],  # Limit content size
            'headings': headings[:20],
            'lists': lists[:30],
            'contacts': contacts,
            'links': internal_links[:20],
            'internal_links': internal_links[:20],
            'success': True
        }
        
    except Exception as e:
        return {
            'url': url,
            'title': 'Error',
            'content': '',
            'headings': [],
            'lists': [],
            'contacts': {},
            'links': [],
            'internal_links': [],
            'success': False,
            'error': str(e)
        }


def crawl_website(start_url: str, max_pages: int = 10) -> List[Dict]:
    """Crawl a website starting from the given URL"""
    visited = set()
    to_visit = [start_url]
    pages = []
    
    while to_visit and len(pages) < max_pages:
        url = to_visit.pop(0)
        
        if url in visited:
            continue
        
        visited.add(url)
        page_data = extract_page_content(url)
        
        if page_data['success']:
            pages.append(page_data)
            
            # Add new links to visit
            for link in page_data['internal_links']:
                if link not in visited and link not in to_visit:
                    to_visit.append(link)
    
    return pages


def extract_qa_suggestions(page_data: Dict) -> List[Dict[str, str]]:
    """Generate Q&A suggestions from page content"""
    suggestions = []
    
    # Common question patterns for service businesses
    question_templates = [
        ("What services do you offer?", "services"),
        ("What are your hours?", "hours|open|schedule"),
        ("How can I contact you?", "contact|call|email|phone"),
        ("Where are you located?", "location|address|area"),
        ("Do you offer emergency services?", "emergency|24|urgent"),
        ("What are your prices?", "price|cost|rate|fee"),
    ]
    
    content_lower = page_data['content'].lower()
    
    for question, keywords in question_templates:
        if re.search(keywords, content_lower):
            # Find relevant sentences
            sentences = re.split(r'[.!?]', page_data['content'])
            relevant = []
            for sent in sentences:
                if re.search(keywords, sent.lower()) and len(sent.strip()) > 20:
                    relevant.append(sent.strip())
            
            if relevant:
                suggestions.append({
                    'question': question,
                    'source_content': '. '.join(relevant[:3]),
                    'keywords': keywords.split('|')
                })
    
    return suggestions


# ==============================================================================
# SUPABASE DIRECT INSERT FUNCTIONS
# These functions write DIRECTLY to Supabase - NO FILES
# ==============================================================================

def crawl_and_store(
    agent_id: str,
    website_url: str,
    max_pages: int = 10
) -> Tuple[str, int, int, List[Dict]]:
    """
    Crawl a website and store ALL data directly in Supabase.
    
    Flow:
    1. Create/get knowledge_base for this agent + URL
    2. Crawl website pages
    3. Store each page in website_data table
    4. Extract Q&A suggestions
    5. Return suggestions for admin curation
    
    Returns: (kb_id, pages_crawled, pages_stored, qa_suggestions)
    """
    print(f"[Crawler] Starting: {website_url} for agent {agent_id}")
    
    client = get_supabase_client()
    
    # Step 1: Create/get knowledge base
    kb_id = get_or_create_knowledge_base(client, agent_id, website_url)
    print(f"[Crawler] Knowledge base: {kb_id}")
    
    # Step 2: Crawl the website
    pages = crawl_website(website_url, max_pages)
    print(f"[Crawler] Crawled {len(pages)} pages")
    
    # Step 3: Store each page in website_data table
    pages_stored = 0
    for page in pages:
        try:
            save_website_data(
                client=client,
                agent_id=agent_id,
                url=page['url'],
                page_title=page['title'],
                content=page['content'],
                headings=page.get('headings', []),
                links=page.get('links', []),
                metadata={
                    'kb_id': kb_id,
                    'contacts': page.get('contacts', {}),
                    'lists_count': len(page.get('lists', []))
                }
            )
            pages_stored += 1
        except Exception as e:
            print(f"[Crawler] Error storing page {page['url']}: {e}")
    
    print(f"[Crawler] Stored {pages_stored} pages in website_data table")
    
    # Step 4: Extract Q&A suggestions from all pages
    all_suggestions = []
    for page in pages:
        suggestions = extract_qa_suggestions(page)
        all_suggestions.extend(suggestions)
    
    print(f"[Crawler] Generated {len(all_suggestions)} Q&A suggestions")
    
    # Update knowledge base status
    update_kb_status(client, kb_id, 'crawled')
    
    return kb_id, len(pages), pages_stored, all_suggestions


def save_qa_to_supabase(
    agent_id: str,
    qa_pairs: List[Dict]
) -> int:
    """
    Save curated Q&A pairs directly to document_chunks table.
    
    Each Q&A pair becomes ONE ROW in document_chunks with:
    - question
    - spoken_response
    - keywords
    - priority
    - kb_id (linked to agent)
    
    Returns: number of Q&A pairs saved
    """
    client = get_supabase_client()
    
    # Get knowledge base for this agent
    kb_id = get_or_create_knowledge_base(client, agent_id, "curated")
    
    saved_count = 0
    for qa in qa_pairs:
        try:
            save_curated_qa(
                client=client,
                kb_id=kb_id,
                question=qa['question'],
                spoken_response=qa['spoken_response'],
                keywords=qa.get('keywords', []),
                priority=qa.get('priority', 5)
            )
            saved_count += 1
        except Exception as e:
            print(f"[Crawler] Error saving Q&A: {e}")
    
    # Mark knowledge base as ready
    update_kb_status(client, kb_id, 'ready')
    
    print(f"[Crawler] Saved {saved_count} Q&A pairs to document_chunks")
    return saved_count


def get_crawl_summary(agent_id: str) -> Dict:
    """Get summary of crawled data for an agent"""
    client = get_supabase_client()
    
    # Count website_data entries
    website_data = client.table('website_data').select('id, url').eq('agent_id', agent_id).execute()
    
    # Count document_chunks (Q&A pairs)
    kb_result = client.table('knowledge_bases').select('id').eq('agent_id', agent_id).execute()
    qa_count = 0
    if kb_result.data:
        for kb in kb_result.data:
            qa_result = client.table('document_chunks').select('id').eq('kb_id', kb['id']).not_.is_('question', 'null').execute()
            qa_count += len(qa_result.data) if qa_result.data else 0
    
    return {
        'agent_id': agent_id,
        'pages_crawled': len(website_data.data) if website_data.data else 0,
        'qa_pairs': qa_count,
        'urls': [d['url'] for d in website_data.data] if website_data.data else []
    }
