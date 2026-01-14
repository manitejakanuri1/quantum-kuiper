"""
Insert Test Q&A Data into Supabase
Run this script to add sample Q&A pairs for testing the RAG system
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from supabase_client import get_supabase_client, get_or_create_knowledge_base, save_curated_qa, update_kb_status

# Sample Q&A pairs for a plumber business
SAMPLE_QA_PAIRS = [
    {
        "question": "What are your business hours?",
        "spoken_response": "We're open Monday through Friday from 8 AM to 6 PM, and Saturdays from 9 AM to 2 PM. We also offer 24/7 emergency plumbing services.",
        "keywords": ["hours", "open", "schedule", "time", "when"],
        "priority": 10
    },
    {
        "question": "What services do you offer?",
        "spoken_response": "We offer a full range of plumbing services including leak repair, pipe installation, water heater service, drain cleaning, and bathroom remodeling. We handle both residential and commercial projects.",
        "keywords": ["services", "offer", "plumbing", "what", "do"],
        "priority": 10
    },
    {
        "question": "How much do you charge?",
        "spoken_response": "Our service call fee is $75, which includes the first 30 minutes of work. After that, we charge $95 per hour. We always provide a free estimate before starting any major work.",
        "keywords": ["price", "cost", "charge", "fee", "how much", "rate"],
        "priority": 9
    },
    {
        "question": "Do you offer emergency services?",
        "spoken_response": "Yes, we offer 24/7 emergency plumbing services. For emergencies like burst pipes or major leaks, call us anytime and we'll dispatch a technician immediately.",
        "keywords": ["emergency", "urgent", "24/7", "immediate", "night"],
        "priority": 10
    },
    {
        "question": "Where are you located?",
        "spoken_response": "We're located at 123 Main Street, downtown. We serve the entire metro area within a 30-mile radius.",
        "keywords": ["location", "address", "where", "area", "serve"],
        "priority": 8
    },
    {
        "question": "How can I contact you?",
        "spoken_response": "You can reach us by phone at 555-123-4567, or email us at info@plumberexample.com. You can also fill out the contact form on our website.",
        "keywords": ["contact", "phone", "call", "email", "reach"],
        "priority": 9
    },
    {
        "question": "Do you offer free estimates?",
        "spoken_response": "Yes, we offer free estimates for all major plumbing work. Just give us a call or fill out our online form, and we'll schedule a time to come out and assess the job.",
        "keywords": ["estimate", "quote", "free", "assessment"],
        "priority": 8
    },
    {
        "question": "Are you licensed and insured?",
        "spoken_response": "Yes, we are fully licensed and insured. Our license number is PL-12345, and we carry $1 million in liability insurance for your protection.",
        "keywords": ["licensed", "insured", "certification", "bonded"],
        "priority": 7
    }
]


def main():
    print("=" * 60)
    print("Inserting Test Q&A Data into Supabase")
    print("=" * 60)
    
    try:
        client = get_supabase_client()
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return
    
    # Get or create a test agent first
    print("\nLooking for existing agents...")
    agents = client.table('agents').select('id, name').execute()
    
    if agents.data:
        agent_id = agents.data[0]['id']
        agent_name = agents.data[0]['name']
        print(f"✅ Using existing agent: {agent_name} ({agent_id})")
    else:
        # Create a test agent
        import uuid
        agent_id = str(uuid.uuid4())
        client.table('agents').insert({
            'id': agent_id,
            'name': 'Test Plumber Agent',
            'website_url': 'https://example-plumber.com',
            'status': 'active'
        }).execute()
        print(f"✅ Created test agent: Test Plumber Agent ({agent_id})")
    
    # Get or create knowledge base
    print("\nSetting up knowledge base...")
    try:
        kb_id = get_or_create_knowledge_base(client, agent_id, "https://example-plumber.com")
        print(f"✅ Knowledge base ready: {kb_id}")
    except Exception as e:
        # Create knowledge base directly
        import uuid
        kb_id = str(uuid.uuid4())
        client.table('knowledge_bases').insert({
            'id': kb_id,
            'agent_id': agent_id,
            'source_url': 'https://example-plumber.com',
            'status': 'ready'
        }).execute()
        print(f"✅ Created knowledge base: {kb_id}")
    
    # Insert Q&A pairs
    print("\nInserting Q&A pairs...")
    for i, qa in enumerate(SAMPLE_QA_PAIRS, 1):
        try:
            save_curated_qa(
                client,
                kb_id,
                question=qa['question'],
                spoken_response=qa['spoken_response'],
                keywords=qa['keywords'],
                priority=qa['priority']
            )
            print(f"  [{i}/{len(SAMPLE_QA_PAIRS)}] ✅ {qa['question'][:50]}...")
        except Exception as e:
            print(f"  [{i}/{len(SAMPLE_QA_PAIRS)}] ❌ Failed: {e}")
    
    # Update knowledge base status
    update_kb_status(client, kb_id, 'ready')
    
    print("\n" + "=" * 60)
    print("✅ Done! Test Q&A data inserted successfully.")
    print(f"   Agent ID: {agent_id}")
    print(f"   Knowledge Base ID: {kb_id}")
    print(f"   Q&A Pairs: {len(SAMPLE_QA_PAIRS)}")
    print("=" * 60)
    print("\nYou can now test queries like:")
    print('  - "What are your hours?"')
    print('  - "How much do you charge?"')
    print('  - "Do you offer emergency services?"')


if __name__ == "__main__":
    main()
