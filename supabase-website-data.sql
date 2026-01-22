-- =====================================================
-- Website Data Table - Production Ready (Idempotent)
-- VERSION: 2.0
-- Run this AFTER supabase-schema.sql
-- Safe to run multiple times
-- NOTE: Consider using website_pages (Firecrawl) instead
-- =====================================================

-- =====================================================
-- 1. WEBSITE DATA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS website_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_title TEXT,
  content TEXT NOT NULL,
  headings TEXT[],
  links TEXT[],
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraints if not exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_url') THEN
    ALTER TABLE website_data ADD CONSTRAINT valid_url CHECK (url ~ '^https?://');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_data_status') THEN
    ALTER TABLE website_data ADD CONSTRAINT valid_data_status CHECK (status IN ('pending', 'processed', 'ready', 'error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_agent_url') THEN
    ALTER TABLE website_data ADD CONSTRAINT unique_agent_url UNIQUE(agent_id, url);
  END IF;
END $$;

-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_website_data_agent 
  ON website_data(agent_id);

CREATE INDEX IF NOT EXISTS idx_website_data_url 
  ON website_data(agent_id, url);

CREATE INDEX IF NOT EXISTS idx_website_data_status 
  ON website_data(agent_id, status);

CREATE INDEX IF NOT EXISTS idx_website_data_content_fts 
  ON website_data USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_website_data_crawled_at 
  ON website_data(agent_id, crawled_at DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE website_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (for idempotency)
DROP POLICY IF EXISTS "Users can read own website_data" ON website_data;
DROP POLICY IF EXISTS "Users can create website_data for own agents" ON website_data;
DROP POLICY IF EXISTS "Users can update own website_data" ON website_data;
DROP POLICY IF EXISTS "Users can delete own website_data" ON website_data;
DROP POLICY IF EXISTS "Service role full access website_data" ON website_data;

-- Recreate policies
CREATE POLICY "Users can read own website_data" ON website_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = website_data.agent_id 
      AND agents.user_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Users can create website_data for own agents" ON website_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = website_data.agent_id 
      AND agents.user_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Users can update own website_data" ON website_data
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = website_data.agent_id 
      AND agents.user_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Users can delete own website_data" ON website_data
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = website_data.agent_id 
      AND agents.user_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_website_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_website_data_updated_at ON website_data;
CREATE TRIGGER set_website_data_updated_at
  BEFORE UPDATE ON website_data
  FOR EACH ROW
  EXECUTE FUNCTION update_website_data_updated_at();

-- =====================================================
-- 5. FUNCTIONS (Drop old versions first)
-- =====================================================

DROP FUNCTION IF EXISTS upsert_website_data(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT[], JSONB);
DROP FUNCTION IF EXISTS get_agent_website_data(UUID);
DROP FUNCTION IF EXISTS search_website_data(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS count_agent_pages(UUID);
DROP FUNCTION IF EXISTS clear_agent_website_data(UUID);

-- Upsert website data
CREATE FUNCTION upsert_website_data(
  p_agent_id UUID,
  p_url TEXT,
  p_page_title TEXT,
  p_content TEXT,
  p_headings TEXT[] DEFAULT NULL,
  p_links TEXT[] DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO website_data (agent_id, url, page_title, content, headings, links, metadata, status)
  VALUES (p_agent_id, p_url, p_page_title, p_content, p_headings, p_links, p_metadata, 'pending')
  ON CONFLICT (agent_id, url) 
  DO UPDATE SET
    page_title = EXCLUDED.page_title,
    content = EXCLUDED.content,
    headings = EXCLUDED.headings,
    links = EXCLUDED.links,
    metadata = EXCLUDED.metadata,
    crawled_at = NOW(),
    status = 'pending'
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Get all website data for an agent
CREATE FUNCTION get_agent_website_data(p_agent_id UUID)
RETURNS TABLE (
  id UUID,
  url TEXT,
  page_title TEXT,
  content TEXT,
  headings TEXT[],
  crawled_at TIMESTAMPTZ,
  status TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id, url, page_title, content, headings, crawled_at, status
  FROM website_data
  WHERE agent_id = p_agent_id
  ORDER BY crawled_at DESC;
$$;

-- Search website data by text
CREATE FUNCTION search_website_data(
  p_agent_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  page_title TEXT,
  excerpt TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wd.id,
    wd.url,
    wd.page_title,
    LEFT(wd.content, 300) as excerpt,
    ts_rank(to_tsvector('english', wd.content), plainto_tsquery('english', p_query))::FLOAT as relevance
  FROM website_data wd
  WHERE wd.agent_id = p_agent_id
    AND wd.status = 'ready'
    AND to_tsvector('english', wd.content) @@ plainto_tsquery('english', p_query)
  ORDER BY relevance DESC
  LIMIT p_limit;
END;
$$;

-- Count pages per agent
CREATE FUNCTION count_agent_pages(p_agent_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM website_data
  WHERE agent_id = p_agent_id;
$$;

-- Delete all data for an agent (for reindex)
CREATE FUNCTION clear_agent_website_data(p_agent_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM website_data WHERE agent_id = p_agent_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- =====================================================
-- 6. PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON website_data TO authenticated;
GRANT ALL ON website_data TO service_role;

GRANT EXECUTE ON FUNCTION upsert_website_data(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_website_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_website_data(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION count_agent_pages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_agent_website_data(UUID) TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON TABLE website_data IS 'Stores crawled website content for agents (legacy, use website_pages for Firecrawl)';
COMMENT ON FUNCTION upsert_website_data(UUID, TEXT, TEXT, TEXT, TEXT[], TEXT[], JSONB) IS 'Insert or update website data with automatic conflict resolution';
COMMENT ON FUNCTION get_agent_website_data(UUID) IS 'Get all crawled pages for an agent';
COMMENT ON FUNCTION search_website_data(UUID, TEXT, INTEGER) IS 'Full-text search across crawled content';
COMMENT ON FUNCTION count_agent_pages(UUID) IS 'Count total pages crawled for an agent';
COMMENT ON FUNCTION clear_agent_website_data(UUID) IS 'Delete all website data for reindexing';

-- =====================================================
-- WEBSITE DATA SCHEMA COMPLETE - Safe to run multiple times
-- =====================================================
