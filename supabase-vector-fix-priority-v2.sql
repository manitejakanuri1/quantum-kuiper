-- =====================================================
-- FIX: Add priority to match_agent_knowledge function
-- =====================================================

-- Drop all versions of the function (handles different signatures)
DROP FUNCTION IF EXISTS match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS match_agent_knowledge(vector, uuid, double precision, integer) CASCADE;
DROP FUNCTION IF EXISTS match_agent_knowledge CASCADE;

-- Create the function with priority support
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
  similarity FLOAT,
  priority INTEGER
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
    (1 - (dc.embedding <=> query_embedding))::FLOAT as similarity,
    COALESCE(dc.priority, 0) as priority
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = match_agent_id
    AND kb.status = 'ready'
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY
    COALESCE(dc.priority, 0) DESC,  -- High priority chunks first
    dc.embedding <=> query_embedding ASC  -- Then by similarity
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) IS
'Find semantically similar document chunks with priority boosting';

-- Grant permissions
GRANT EXECUTE ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION match_agent_knowledge(vector(384), UUID, FLOAT, INTEGER) TO anon;

-- =====================================================
-- PRIORITY FIX COMPLETE
-- =====================================================
