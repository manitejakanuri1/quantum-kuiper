-- =====================================================
-- DEVELOPMENT ONLY: Disable RLS for easier testing
-- Run this in Supabase SQL Editor
-- IMPORTANT: Re-enable RLS before going to production!
-- =====================================================

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
ALTER TABLE voices DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Also drop the foreign key constraint on agents.user_id temporarily
-- This allows creating agents without requiring the user to exist first
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_user_id_fkey;

-- Re-add it as a simple reference without CASCADE (for dev)
-- ALTER TABLE agents ADD CONSTRAINT agents_user_id_fkey 
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Grant full permissions to anon role for development
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Confirmation message
SELECT 'RLS disabled for development. Remember to re-enable before production!' AS message;
