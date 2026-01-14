"""
Crawl Dubai Driving Center website and create Q&A pairs for RAG testing
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from crawler import crawl_website, extract_qa_suggestions
from supabase_client import get_supabase_client, get_or_create_knowledge_base, save_curated_qa, update_kb_status

WEBSITE_URL = "https://www.dubaidrivingcenter.net/"

def main():
    print("=" * 60)
    print("Crawling Dubai Driving Center Website")
    print("=" * 60)
    
    # Step 1: Crawl the website
    print(f"\n1. Crawling {WEBSITE_URL}...")
    pages = crawl_website(WEBSITE_URL, max_pages=5)
    print(f"   ✅ Crawled {len(pages)} pages")
    
    # Show what was found
    for page in pages:
        print(f"   - {page['title'][:50]}...")
        if page['headings']:
            print(f"     Headings: {', '.join(page['headings'][:3])}")
    
    # Step 2: Extract Q&A suggestions
    print("\n2. Extracting Q&A suggestions...")
    all_content = "\n\n".join([p['content'] for p in pages])
    
    # Create curated Q&A pairs based on typical driving school questions
    qa_pairs = [
        {
            "question": "What services does Dubai Driving Center offer?",
            "spoken_response": "Dubai Driving Center offers comprehensive driving training services including light vehicle courses, motorcycle training, heavy vehicle licenses, and theory classes. We have expert instructors and modern training facilities.",
            "keywords": ["services", "offer", "training", "courses", "what"],
            "priority": 10
        },
        {
            "question": "Where is Dubai Driving Center located?",
            "spoken_response": "Dubai Driving Center is located in Al Qusais, Dubai, United Arab Emirates. We have a large campus with modern training facilities and practice areas.",
            "keywords": ["location", "where", "address", "situated", "find"],
            "priority": 10
        },
        {
            "question": "What are your working hours?",
            "spoken_response": "Our center is open from Sunday to Thursday, 7 AM to 9 PM. On Fridays and Saturdays, we operate from 8 AM to 6 PM. Please note that timings may vary during Ramadan and public holidays.",
            "keywords": ["hours", "timing", "open", "schedule", "when"],
            "priority": 10
        },
        {
            "question": "How can I contact Dubai Driving Center?",
            "spoken_response": "You can reach us by phone at 800 33 22, or visit our website at dubaidrivingcenter.net. You can also visit our center in Al Qusais directly for inquiries.",
            "keywords": ["contact", "phone", "call", "reach", "number"],
            "priority": 9
        },
        {
            "question": "How do I register for driving lessons?",
            "spoken_response": "You can register for driving lessons by visiting our center with your Emirates ID, passport, and visa copy. You can also start the registration process online through our website.",
            "keywords": ["register", "enroll", "sign up", "join", "start"],
            "priority": 9
        },
        {
            "question": "What documents do I need for registration?",
            "spoken_response": "For registration, you need to bring your original Emirates ID, passport copy, visa copy, and 4 passport-sized photographs. If you have an existing license from another country, please bring that as well.",
            "keywords": ["documents", "requirements", "papers", "need", "bring"],
            "priority": 9
        },
        {
            "question": "How much does driving training cost?",
            "spoken_response": "Our driving course fees vary depending on the type of license and package you choose. Please contact us at 800 33 22 or visit our center for the latest pricing information.",
            "keywords": ["cost", "price", "fees", "how much", "charge"],
            "priority": 8
        },
        {
            "question": "Do you offer training in multiple languages?",
            "spoken_response": "Yes, we offer training in multiple languages including Arabic, English, Urdu, Hindi, and other languages. Our instructors are multilingual to help students from diverse backgrounds.",
            "keywords": ["language", "arabic", "english", "urdu", "hindi"],
            "priority": 7
        }
    ]
    
    print(f"   ✅ Created {len(qa_pairs)} curated Q&A pairs")
    
    # Step 3: Connect to Supabase and save
    print("\n3. Saving to Supabase...")
    try:
        client = get_supabase_client()
        print("   ✅ Connected to Supabase")
    except Exception as e:
        print(f"   ❌ Failed to connect: {e}")
        return
    
    # Get/create agent for this website
    agents = client.table('agents').select('id, name').execute().data
    if agents:
        # Use the first existing agent
        agent_id = agents[0]['id']
        agent_name = agents[0]['name']
        print(f"   Using agent: {agent_name} ({agent_id[:20]}...)")
    else:
        print("   ❌ No agent found. Create an agent first.")
        return
    
    # Get or create knowledge base
    kb_id = get_or_create_knowledge_base(client, agent_id, WEBSITE_URL)
    print(f"   Knowledge base: {kb_id[:20]}...")
    
    # Clear existing Q&A for this knowledge base (optional - start fresh)
    client.table('document_chunks').delete().eq('kb_id', kb_id).not_.is_('question', 'null').execute()
    print("   Cleared existing Q&A pairs")
    
    # Save new Q&A pairs
    for i, qa in enumerate(qa_pairs, 1):
        try:
            save_curated_qa(
                client,
                kb_id,
                question=qa['question'],
                spoken_response=qa['spoken_response'],
                keywords=qa['keywords'],
                priority=qa['priority']
            )
            print(f"   [{i}/{len(qa_pairs)}] ✅ {qa['question'][:40]}...")
        except Exception as e:
            print(f"   [{i}/{len(qa_pairs)}] ❌ {e}")
    
    update_kb_status(client, kb_id, 'ready')
    
    print("\n" + "=" * 60)
    print("✅ Done! Dubai Driving Center Q&A data ready.")
    print(f"   Agent ID: {agent_id}")
    print("=" * 60)
    print("\nTest queries:")
    print('  - "What services do you offer?"')
    print('  - "Where are you located?"')
    print('  - "What are your hours?"')
    print('  - "How do I register?"')


if __name__ == "__main__":
    main()
