-- =====================================================
-- Migration: Add Firecrawl Website Pages Table
-- PRODUCTION VERSION - First Time Setup
-- =====================================================

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SETTINGS TABLE (for API keys and configuration)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for settings (only service role can access)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for settings" ON app_settings;
CREATE POLICY "Service role only for settings" ON app_settings
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
GRANT ALL ON app_settings TO service_role;

-- Insert Firecrawl API Key (use upsert for idempotency)
INSERT INTO app_settings (key, value, encrypted, description)
VALUES (
  'FIRECRAWL_API_KEY',
  'fc-a7278d523597458181b858d90eff5349',
  false,
  'Firecrawl API key for website crawling'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

COMMENT ON TABLE app_settings IS 'Application settings and API keys (service_role access only)';

-- =====================================================
-- 1. WEBSITE PAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS website_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  website_url TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_title TEXT,
  extracted_text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- For storing additional page metadata
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_website_url CHECK (website_url ~ '^https?://'),
  CONSTRAINT valid_page_url CHECK (page_url ~ '^https?://'),
  CONSTRAINT unique_agent_page UNIQUE(agent_id, page_url)
);

-- =====================================================
-- 2. AGENTS TABLE MODIFICATIONS
-- =====================================================
ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS crawl_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS crawl_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pages_crawled INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crawl_error TEXT; -- Track crawl errors

-- Add constraint for valid crawl statuses
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_crawl_status'
  ) THEN
    ALTER TABLE agents 
      ADD CONSTRAINT valid_crawl_status 
      CHECK (crawl_status IN ('pending', 'crawling', 'completed', 'failed'));
  END IF;
END $$;

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

-- Fast agent lookup
CREATE INDEX IF NOT EXISTS idx_website_pages_agent_id 
  ON website_pages(agent_id);

-- Full-text search on extracted content
CREATE INDEX IF NOT EXISTS idx_website_pages_text_search 
  ON website_pages USING gin(to_tsvector('english', extracted_text));

-- Search by website URL (useful for filtering by domain)
CREATE INDEX IF NOT EXISTS idx_website_pages_website_url 
  ON website_pages(agent_id, website_url);

-- Recent pages lookup
CREATE INDEX IF NOT EXISTS idx_website_pages_crawled_at 
  ON website_pages(agent_id, crawled_at DESC);

-- Agent crawl status lookup
CREATE INDEX IF NOT EXISTS idx_agents_crawl_status 
  ON agents(crawl_status) 
  WHERE crawl_status IS NOT NULL;

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: Adjust these policies based on your auth setup
-- Option A: If agents have a user_id column (RECOMMENDED FOR PRODUCTION)

CREATE POLICY "Users can read their agent's website_pages" 
  ON website_pages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = website_pages.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create website_pages for their agents" 
  ON website_pages FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = website_pages.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their agent's website_pages" 
  ON website_pages FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = website_pages.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Service role bypass (for backend operations)
CREATE POLICY "Service role has full access to website_pages" 
  ON website_pages 
  USING (auth.jwt()->>'role' = 'service_role');

-- Option B: If you need public read access (TESTING ONLY - UNCOMMENT IF NEEDED)
-- CREATE POLICY "Public read access to website_pages" 
--   ON website_pages FOR SELECT 
--   USING (true);

-- =====================================================
-- 5. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_website_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_website_pages_updated_at
  BEFORE UPDATE ON website_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_website_pages_updated_at();

-- Update pages_crawled count trigger
CREATE OR REPLACE FUNCTION update_agent_pages_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agents 
    SET pages_crawled = (
      SELECT COUNT(*) FROM website_pages 
      WHERE agent_id = NEW.agent_id
    )
    WHERE id = NEW.agent_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE agents 
    SET pages_crawled = (
      SELECT COUNT(*) FROM website_pages 
      WHERE agent_id = OLD.agent_id
    )
    WHERE id = OLD.agent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pages_count_on_insert
  AFTER INSERT ON website_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_pages_count();

CREATE TRIGGER update_pages_count_on_delete
  AFTER DELETE ON website_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_pages_count();

-- =====================================================
-- 6. HELPER FUNCTIONS (OPTIONAL BUT USEFUL)
-- =====================================================

-- Function to search website pages by text
CREATE OR REPLACE FUNCTION search_website_pages(
  p_agent_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  page_url TEXT,
  page_title TEXT,
  excerpt TEXT,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wp.id,
    wp.page_url,
    wp.page_title,
    LEFT(wp.extracted_text, 200) as excerpt,
    ts_rank(to_tsvector('english', wp.extracted_text), plainto_tsquery('english', p_query)) as relevance
  FROM website_pages wp
  WHERE wp.agent_id = p_agent_id
    AND to_tsvector('english', wp.extracted_text) @@ plainto_tsquery('english', p_query)
  ORDER BY relevance DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE website_pages IS 'Stores crawled website content from Firecrawl for AI agents';
COMMENT ON COLUMN website_pages.agent_id IS 'The agent that owns this crawled content';
COMMENT ON COLUMN website_pages.website_url IS 'The root website URL that was crawled';
COMMENT ON COLUMN website_pages.page_url IS 'The specific page URL';
COMMENT ON COLUMN website_pages.extracted_text IS 'The main text content extracted from the page';
COMMENT ON COLUMN website_pages.metadata IS 'Additional metadata like headers, links, etc.';

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

-- Grant appropriate permissions (adjust based on your roles)
GRANT SELECT, INSERT, DELETE ON website_pages TO authenticated;
GRANT ALL ON website_pages TO service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verification Query (run this after migration to confirm setup):
-- SELECT 
--   tablename, 
--   policyname, 
--   permissive, 
--   roles, 
--   cmd 
-- FROM pg_policies 
-- WHERE tablename = 'website_pages';
