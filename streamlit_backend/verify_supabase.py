from supabase_client import get_supabase_client

c = get_supabase_client()

# Get all Q&A pairs with questions
chunks = c.table('document_chunks').select('question').not_.is_('question', 'null').execute().data

print(f"SUPABASE DATA: {len(chunks)} Q&A pairs stored")
for i, chunk in enumerate(chunks, 1):
    print(f"  {i}. {chunk['question']}")
