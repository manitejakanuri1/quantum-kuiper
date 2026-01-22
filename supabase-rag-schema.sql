-- =====================================================
-- RAG System Extensions - Production Ready
-- VERSION: 2.0 (Idempotent)
-- Run this AFTER supabase-schema.sql
-- Safe to run multiple times
-- =====================================================

-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- 1. EXTEND DOCUMENT_CHUNKS TABLE
-- =====================================================

-- Add columns if they don't exist (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_chunks' AND column_name = 'question') THEN
    ALTER TABLE document_chunks ADD COLUMN question TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_chunks' AND column_name = 'spoken_response') THEN
    ALTER TABLE document_chunks ADD COLUMN spoken_response TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_chunks' AND column_name = 'keywords') THEN
    ALTER TABLE document_chunks ADD COLUMN keywords TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_chunks' AND column_name = 'priority') THEN
    ALTER TABLE document_chunks ADD COLUMN priority INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- 2. INDEXES FOR RAG QUERIES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_chunks_question_trgm 
  ON document_chunks USING gin(question gin_trgm_ops)
  WHERE question IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_keywords 
  ON document_chunks USING gin(keywords)
  WHERE keywords IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_priority 
  ON document_chunks(kb_id, priority DESC)
  WHERE priority > 0;

CREATE INDEX IF NOT EXISTS idx_chunks_content_fts 
  ON document_chunks USING gin(to_tsvector('english', content));

-- =====================================================
-- 3. DROP OLD FUNCTION VERSIONS (for clean recreation)
-- =====================================================

-- Drop all versions of find_best_answer
DROP FUNCTION IF EXISTS find_best_answer(TEXT, UUID);
DROP FUNCTION IF EXISTS find_best_answer(TEXT, UUID, FLOAT);

-- Drop all versions of search_by_keywords
DROP FUNCTION IF EXISTS search_by_keywords(TEXT[], UUID);
DROP FUNCTION IF EXISTS search_by_keywords(TEXT[], UUID, INTEGER);

-- Drop all versions of search_content
DROP FUNCTION IF EXISTS search_content(TEXT, UUID);
DROP FUNCTION IF EXISTS search_content(TEXT, UUID, INTEGER);

-- Drop helper functions
DROP FUNCTION IF EXISTS get_agent_chunks(UUID);
DROP FUNCTION IF EXISTS count_agent_chunks(UUID);

-- =====================================================
-- 4. SEARCH FUNCTIONS
-- =====================================================

-- Find best matching answer using fuzzy matching
CREATE FUNCTION find_best_answer(
  user_query TEXT,
  p_agent_id UUID,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  spoken_response TEXT,
  content TEXT,
  similarity FLOAT,
  source TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.question,
    dc.spoken_response,
    dc.content,
    COALESCE(similarity(dc.question, user_query), 0.0)::FLOAT as similarity,
    dc.source
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id
    AND kb.status = 'ready'
    AND (dc.spoken_response IS NOT NULL OR dc.content IS NOT NULL)
    AND (
      dc.question IS NULL 
      OR similarity(dc.question, user_query) >= similarity_threshold
    )
  ORDER BY 
    similarity(dc.question, user_query) DESC NULLS LAST,
    dc.priority DESC
  LIMIT 1;
END;
$$;

-- Search by keywords with ranking
CREATE FUNCTION search_by_keywords(
  search_keywords TEXT[],
  p_agent_id UUID,
  match_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  spoken_response TEXT,
  content TEXT,
  matched_keywords TEXT[],
  match_count INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.question,
    dc.spoken_response,
    dc.content,
    dc.keywords & search_keywords as matched_keywords,
    array_length(dc.keywords & search_keywords, 1) as match_count
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id
    AND kb.status = 'ready'
    AND dc.keywords && search_keywords
  ORDER BY 
    array_length(dc.keywords & search_keywords, 1) DESC NULLS LAST,
    dc.priority DESC
  LIMIT match_limit;
END;
$$;

-- Full-text search on content
CREATE FUNCTION search_content(
  search_query TEXT,
  p_agent_id UUID,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.content,
    dc.source,
    ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', search_query))::FLOAT as relevance
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id
    AND kb.status = 'ready'
    AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', search_query)
  ORDER BY relevance DESC
  LIMIT result_limit;
END;
$$;

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Get all chunks for an agent
CREATE FUNCTION get_agent_chunks(p_agent_id UUID)
RETURNS TABLE (
  id UUID,
  content TEXT,
  question TEXT,
  spoken_response TEXT,
  source TEXT,
  priority INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    dc.id, 
    dc.content, 
    dc.question, 
    dc.spoken_response, 
    dc.source,
    dc.priority
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id
  ORDER BY dc.priority DESC, dc.created_at ASC;
$$;

-- Count chunks per agent
CREATE FUNCTION count_agent_chunks(p_agent_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id;
$$;

-- =====================================================
-- 6. PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION find_best_answer(TEXT, UUID, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_by_keywords(TEXT[], UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_content(TEXT, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_chunks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION count_agent_chunks(UUID) TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON FUNCTION find_best_answer(TEXT, UUID, FLOAT) IS 'Find the best matching Q&A pair for a user query using fuzzy matching';
COMMENT ON FUNCTION search_by_keywords(TEXT[], UUID, INTEGER) IS 'Search document chunks by keyword array with ranking';
COMMENT ON FUNCTION search_content(TEXT, UUID, INTEGER) IS 'Full-text search across all content for an agent';
COMMENT ON FUNCTION get_agent_chunks(UUID) IS 'Get all document chunks belonging to an agent';
COMMENT ON FUNCTION count_agent_chunks(UUID) IS 'Count total document chunks for an agent';

-- =====================================================
-- RAG SCHEMA COMPLETE - Safe to run multiple times
-- =====================================================
