-- ============================================================================
-- WEBSITE DATA TABLE - Stores all crawled website content in one place
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Create the website_data table
CREATE TABLE IF NOT EXISTS website_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    page_title TEXT,
    content TEXT NOT NULL,
    headings TEXT[],
    links TEXT[],
    metadata JSONB DEFAULT '{}',
    crawled_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending'  -- pending, processed, ready
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_website_data_agent ON website_data(agent_id);
CREATE INDEX IF NOT EXISTS idx_website_data_url ON website_data(url);
CREATE INDEX IF NOT EXISTS idx_website_data_status ON website_data(status);

-- Enable full-text search on content
CREATE INDEX IF NOT EXISTS idx_website_data_content_fts 
ON website_data USING gin(to_tsvector('english', content));

-- Create unique constraint to prevent duplicate URLs per agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_website_data_unique_url 
ON website_data(agent_id, url);

-- Grant permissions
GRANT ALL ON website_data TO anon, authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to insert or update website data (upsert)
CREATE OR REPLACE FUNCTION upsert_website_data(
    p_agent_id UUID,
    p_url TEXT,
    p_page_title TEXT,
    p_content TEXT,
    p_headings TEXT[],
    p_links TEXT[],
    p_metadata JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Try to insert, on conflict update
    INSERT INTO website_data (agent_id, url, page_title, content, headings, links, metadata)
    VALUES (p_agent_id, p_url, p_page_title, p_content, p_headings, p_links, p_metadata)
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

-- Function to get all website data for an agent
CREATE OR REPLACE FUNCTION get_agent_website_data(p_agent_id UUID)
RETURNS TABLE (
    id UUID,
    url TEXT,
    page_title TEXT,
    content TEXT,
    headings TEXT[],
    crawled_at TIMESTAMPTZ,
    status TEXT
)
LANGUAGE sql STABLE
AS $$
    SELECT id, url, page_title, content, headings, crawled_at, status
    FROM website_data
    WHERE agent_id = p_agent_id
    ORDER BY crawled_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_website_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_agent_website_data TO anon, authenticated;
