from supabase_client import get_supabase_client

c = get_supabase_client()

# Get chunks with questions and their KB
chunks = c.table('document_chunks').select('kb_id').not_.is_('question', 'null').limit(1).execute().data
if chunks:
    kb_id = chunks[0]['kb_id']
    kb = c.table('knowledge_bases').select('agent_id').eq('id', kb_id).execute().data
    if kb:
        print(kb[0]['agent_id'])
