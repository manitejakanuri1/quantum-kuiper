-- =====================================================
-- PGVECTOR MIGRATION FOR RAG SYSTEM
-- VERSION: 1.0
-- Run this AFTER supabase-schema.sql and supabase-rag-schema.sql
-- Adds vector search capability for semantic RAG
-- =====================================================

-- =====================================================
-- 1. ENABLE PGVECTOR EXTENSION
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION vector IS 'Vector similarity search for embeddings';

-- =====================================================
-- 2. ADD EMBEDDING COLUMN TO DOCUMENT_CHUNKS
-- =====================================================

-- Add vector column for embeddings (384 dimensions for all-MiniLM-L6-v2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks'
    AND column_name = 'embedding'
  ) THEN
    ALTER TABLE document_chunks
    ADD COLUMN embedding vector(384);

    COMMENT ON COLUMN document_chunks.embedding IS 'Semantic embedding vector (384d) from all-MiniLM-L6-v2 model';
  END IF;
END $$;

-- =====================================================
-- 3. CREATE VECTOR SIMILARITY INDEX
-- =====================================================

-- IVFFlat index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMENT ON INDEX idx_chunks_embedding_ivfflat IS 'IVFFlat index for fast vector similarity search using cosine distance';

-- =====================================================
-- 4. CREATE VECTOR SEARCH FUNCTION
-- =====================================================

-- Drop existing function if it exists (for clean recreation)
DROP FUNCTION IF EXISTS match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER);

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION match_agent_knowledge(
  query_embedding vector(384),
  match_agent_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  kb_id UUID,
  chunk_text TEXT,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.kb_id,
    dc.content as chunk_text,
    dc.source,
    (1 - (dc.embedding <=> query_embedding))::FLOAT as similarity
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = match_agent_id
    AND kb.status = 'ready'
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) IS
'Find semantically similar document chunks for an agent using vector cosine similarity';

-- =====================================================
-- 5. PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) TO anon;

-- =====================================================
-- 6. HELPER FUNCTION - COUNT CHUNKS WITH EMBEDDINGS
-- =====================================================

CREATE OR REPLACE FUNCTION count_agent_chunks_with_embeddings(p_agent_id UUID)
RETURNS TABLE (
  total_chunks INTEGER,
  chunks_with_embeddings INTEGER,
  embedding_coverage FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::INTEGER as total_chunks,
    COUNT(dc.embedding)::INTEGER as chunks_with_embeddings,
    (COUNT(dc.embedding)::FLOAT / NULLIF(COUNT(*), 0))::FLOAT as embedding_coverage
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id;
$$;

COMMENT ON FUNCTION count_agent_chunks_with_embeddings(UUID) IS
'Get embedding coverage statistics for an agent';

GRANT EXECUTE ON FUNCTION count_agent_chunks_with_embeddings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION count_agent_chunks_with_embeddings(UUID) TO service_role;

-- =====================================================
-- 7. TEST QUERY (OPTIONAL - FOR VERIFICATION)
-- =====================================================

-- Example test query (comment out in production):
-- SELECT COUNT(*) as chunks_with_embeddings
-- FROM document_chunks
-- WHERE embedding IS NOT NULL;

-- =====================================================
-- PGVECTOR MIGRATION COMPLETE
-- =====================================================

-- Verification steps:
-- 1. SELECT * FROM pg_extension WHERE extname = 'vector';
-- 2. \d document_chunks  (should show embedding vector(384) column)
-- 3. SELECT count_agent_chunks_with_embeddings('your-agent-id-here');
