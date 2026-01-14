"""
Test RAG with a NEW Website - End-to-End
This script simulates a real user flow:
1. Crawl a new website
2. Store data in Supabase
3. Create Q&A pairs
4. Test the RAG queries

Usage:
    python test_new_website.py --url https://example.com --agent-id YOUR_AGENT_ID
"""

import requests
import argparse
import json
import time

RAG_API_URL = "http://localhost:8000"


def test_new_website(website_url: str, agent_id: str, max_pages: int = 5):
    """
    Complete end-to-end test with a new website
    """
    print("\n" + "=" * 70)
    print("🌐 NEW WEBSITE TEST - End-to-End Flow")
    print("=" * 70)
    print(f"Website: {website_url}")
    print(f"Agent ID: {agent_id}")
    print("=" * 70)
    
    # =========================================================================
    # STEP 1: Crawl the website
    # =========================================================================
    print("\n📥 STEP 1: Crawling website...")
    
    crawl_response = requests.post(
        f"{RAG_API_URL}/api/crawl",
        json={
            "url": website_url,
            "agent_id": agent_id,
            "max_pages": max_pages
        },
        timeout=60
    )
    
    if not crawl_response.ok:
        print(f"❌ Crawl failed: {crawl_response.text}")
        return False
    
    crawl_data = crawl_response.json()
    print(f"   ✅ Pages crawled: {crawl_data.get('pages_crawled', 0)}")
    print(f"   ✅ Pages saved to DB: {crawl_data.get('pages_saved', 0)}")
    print(f"   ✅ Q&A suggestions: {len(crawl_data.get('qa_suggestions', []))}")
    print(f"   ✅ KB ID: {crawl_data.get('kb_id', 'N/A')}")
    
    # =========================================================================
    # STEP 2: Show Q&A Suggestions
    # =========================================================================
    print("\n📝 STEP 2: Q&A Suggestions from crawled content...")
    
    suggestions = crawl_data.get('qa_suggestions', [])
    if suggestions:
        for i, qa in enumerate(suggestions[:5], 1):
            print(f"   {i}. Q: {qa.get('question', 'N/A')}")
            print(f"      A: {qa.get('source_content', 'N/A')[:80]}...")
    else:
        print("   ⚠️ No suggestions generated. Creating generic Q&A pairs...")
        suggestions = [
            {"question": "What services do you offer?", "source_content": "We provide various services.", "keywords": ["services"]},
            {"question": "How can I contact you?", "source_content": "Contact us via phone or email.", "keywords": ["contact"]},
            {"question": "What are your hours?", "source_content": "We are open during business hours.", "keywords": ["hours"]},
        ]
    
    # =========================================================================
    # STEP 3: Save Q&A pairs to database
    # =========================================================================
    print("\n💾 STEP 3: Saving Q&A pairs to Supabase...")
    
    qa_pairs = []
    for qa in suggestions[:8]:  # Save up to 8 Q&A pairs
        qa_pairs.append({
            "question": qa.get('question', ''),
            "spoken_response": qa.get('source_content', '')[:500],  # Limit length
            "keywords": qa.get('keywords', []),
            "priority": 5
        })
    
    # Filter out empty Q&A pairs
    qa_pairs = [qa for qa in qa_pairs if qa['question'] and qa['spoken_response']]
    
    if qa_pairs:
        save_response = requests.post(
            f"{RAG_API_URL}/api/qa/save",
            json={
                "agent_id": agent_id,
                "qa_pairs": qa_pairs
            },
            timeout=30
        )
        
        if save_response.ok:
            save_data = save_response.json()
            print(f"   ✅ Saved {save_data.get('saved_count', 0)} Q&A pairs")
        else:
            print(f"   ❌ Save failed: {save_response.text}")
    else:
        print("   ⚠️ No valid Q&A pairs to save")
    
    # =========================================================================
    # STEP 4: Test RAG Queries
    # =========================================================================
    print("\n🔍 STEP 4: Testing RAG queries...")
    
    test_queries = [
        "What services do you offer?",
        "How can I contact you?",
        "What are your hours?",
        "Random gibberish xyz123",  # Should return fallback
    ]
    
    for query in test_queries:
        response = requests.post(
            f"{RAG_API_URL}/api/query",
            json={"query": query, "agent_id": agent_id},
            timeout=10
        )
        
        if response.ok:
            data = response.json()
            found = data.get('found', False)
            threshold_met = data.get('threshold_met', False)
            similarity = data.get('similarity', 0)
            
            if found and threshold_met:
                status = f"✅ MATCH ({similarity:.1%})"
            else:
                status = f"⚪ FALLBACK ({similarity:.1%})"
            
            print(f"   {status} | {query[:40]}")
        else:
            print(f"   ❌ ERROR | {query[:40]}")
    
    # =========================================================================
    # STEP 5: Show stored website data
    # =========================================================================
    print("\n📊 STEP 5: Verifying data in Supabase...")
    
    website_data_response = requests.get(
        f"{RAG_API_URL}/api/website-data/{agent_id}",
        timeout=10
    )
    
    if website_data_response.ok:
        website_data = website_data_response.json()
        print(f"   ✅ Website pages stored: {website_data.get('total', 0)}")
    
    qa_response = requests.get(
        f"{RAG_API_URL}/api/qa/{agent_id}",
        timeout=10
    )
    
    if qa_response.ok:
        qa_data = qa_response.json()
        print(f"   ✅ Q&A pairs stored: {qa_data.get('total', 0)}")
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "=" * 70)
    print("✅ END-TO-END TEST COMPLETE")
    print("=" * 70)
    print(f"Website: {website_url}")
    print(f"Pages stored in website_data: {crawl_data.get('pages_saved', 0)}")
    print(f"Q&A pairs stored in document_chunks: {len(qa_pairs)}")
    print("=" * 70)
    
    return True


def list_agents():
    """List available agents"""
    response = requests.get(f"{RAG_API_URL}/api/agents", timeout=5)
    if response.ok:
        agents = response.json().get("agents", [])
        print("\nAvailable Agents:")
        for agent in agents:
            print(f"  • {agent.get('name', 'Unknown')}: {agent['id']}")
        return agents
    return []


def main():
    parser = argparse.ArgumentParser(description="Test RAG with a new website")
    parser.add_argument("--url", help="Website URL to crawl and test")
    parser.add_argument("--agent-id", help="Agent ID to use")
    parser.add_argument("--max-pages", type=int, default=5, help="Max pages to crawl")
    parser.add_argument("--list-agents", action="store_true", help="List available agents")
    args = parser.parse_args()
    
    # Check API
    try:
        response = requests.get(f"{RAG_API_URL}/health", timeout=5)
        if not response.ok:
            print("❌ RAG API not responding")
            return
    except:
        print(f"❌ Cannot connect to RAG API at {RAG_API_URL}")
        return
    
    print("✅ RAG API is running")
    
    if args.list_agents or not args.agent_id:
        agents = list_agents()
        if not args.url:
            print("\nUsage:")
            print("  python test_new_website.py --url https://example.com --agent-id <ID>")
            return
    
    if not args.url:
        print("❌ Please provide --url")
        return
    
    if not args.agent_id:
        agents = list_agents()
        if agents:
            args.agent_id = agents[0]['id']
            print(f"\nUsing first agent: {args.agent_id}")
        else:
            print("❌ No agents found")
            return
    
    test_new_website(args.url, args.agent_id, args.max_pages)


if __name__ == "__main__":
    main()
