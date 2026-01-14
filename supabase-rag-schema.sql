-- Supabase Schema Updates for LLM-Free RAG System
-- Run this in the Supabase SQL Editor after the initial schema

-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add new columns to document_chunks for curated Q&A
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS question TEXT,
ADD COLUMN IF NOT EXISTS spoken_response TEXT,
ADD COLUMN IF NOT EXISTS keywords TEXT[],
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Create trigram index for fuzzy question matching
CREATE INDEX IF NOT EXISTS idx_chunks_question_trgm 
ON document_chunks USING gin (question gin_trgm_ops);

-- Create index on keywords array
CREATE INDEX IF NOT EXISTS idx_chunks_keywords 
ON document_chunks USING gin (keywords);

-- Function to find the best matching answer for a user query
CREATE OR REPLACE FUNCTION find_best_answer(
  user_query TEXT,
  p_agent_id UUID
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  spoken_response TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.question,
    dc.spoken_response,
    dc.content,
    COALESCE(similarity(dc.question, user_query), 0.0)::FLOAT as similarity
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id
    AND (dc.spoken_response IS NOT NULL OR dc.content IS NOT NULL)
  ORDER BY 
    similarity(dc.question, user_query) DESC NULLS LAST,
    dc.priority DESC
  LIMIT 1;
END;
$$;

-- Function to search by keywords
CREATE OR REPLACE FUNCTION search_by_keywords(
  search_keywords TEXT[],
  p_agent_id UUID,
  match_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  question TEXT,
  spoken_response TEXT,
  content TEXT,
  matched_keywords TEXT[]
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.question,
    dc.spoken_response,
    dc.content,
    dc.keywords & search_keywords as matched_keywords
  FROM document_chunks dc
  JOIN knowledge_bases kb ON dc.kb_id = kb.id
  WHERE kb.agent_id = p_agent_id
    AND dc.keywords && search_keywords
  ORDER BY array_length(dc.keywords & search_keywords, 1) DESC NULLS LAST
  LIMIT match_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_best_answer TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_by_keywords TO anon, authenticated;
