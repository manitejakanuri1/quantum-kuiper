from supabase_client import get_supabase_client

c = get_supabase_client()

# Get chunks that have question field and find their agent
chunks = c.table('document_chunks').select('id, question, spoken_response, kb_id').not_.is_('question', 'null').limit(3).execute().data
print(f"Sample Q&A chunks:")
for chunk in chunks:
    print(f"  Q: {chunk['question']}")
    print(f"  A: {chunk['spoken_response'][:80]}...")
    print(f"  KB: {chunk['kb_id']}")
    print()

# Get the knowledge base for these chunks
if chunks:
    kb_id = chunks[0]['kb_id']
    kb = c.table('knowledge_bases').select('agent_id').eq('id', kb_id).execute().data
    if kb:
        agent_id = kb[0]['agent_id']
        print(f">>> USE THIS AGENT ID: {agent_id}")
