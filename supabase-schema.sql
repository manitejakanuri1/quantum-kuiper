-- =====================================================
-- VoiceAgent Platform - Production Database Schema
-- VERSION: 2.0 - Production Ready (Idempotent)
-- Run this in Supabase SQL Editor
-- Safe to run multiple times
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraint if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_email') THEN
    ALTER TABLE users ADD CONSTRAINT valid_email 
      CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;

-- =====================================================
-- 2. AGENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT,
  face_id TEXT,
  voice_id TEXT,
  system_prompt TEXT,
  status TEXT DEFAULT 'active',
  embed_code TEXT,
  crawl_status TEXT DEFAULT 'pending',
  crawl_completed_at TIMESTAMPTZ,
  pages_crawled INTEGER DEFAULT 0,
  crawl_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add constraints if not exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_status') THEN
    ALTER TABLE agents ADD CONSTRAINT valid_status 
      CHECK (status IN ('active', 'inactive', 'training'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_crawl_status') THEN
    ALTER TABLE agents ADD CONSTRAINT valid_crawl_status 
      CHECK (crawl_status IN ('pending', 'crawling', 'completed', 'failed'));
  END IF;
END $$;

-- =====================================================
-- 3. VOICES TABLE (FishAudio)
-- =====================================================
CREATE TABLE IF NOT EXISTS voices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'neutral',
  style TEXT,
  preview_url TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_gender') THEN
    ALTER TABLE voices ADD CONSTRAINT valid_gender 
      CHECK (gender IN ('male', 'female', 'neutral'));
  END IF;
END $$;

-- =====================================================
-- 4. KNOWLEDGE BASES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  source_url TEXT,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_kb_status') THEN
    ALTER TABLE knowledge_bases ADD CONSTRAINT valid_kb_status 
      CHECK (status IN ('processing', 'ready', 'error'));
  END IF;
END $$;

-- =====================================================
-- 5. DOCUMENT CHUNKS TABLE (for RAG)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kb_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT,
  chunk_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  question TEXT,
  spoken_response TEXT,
  keywords TEXT[],
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6. SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}'
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_session_status') THEN
    ALTER TABLE sessions ADD CONSTRAINT valid_session_status 
      CHECK (status IN ('active', 'ended', 'error'));
  END IF;
END $$;

-- =====================================================
-- 7. MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_role') THEN
    ALTER TABLE messages ADD CONSTRAINT valid_role 
      CHECK (role IN ('user', 'agent', 'system'));
  END IF;
END $$;

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_crawl_status ON agents(crawl_status);
CREATE INDEX IF NOT EXISTS idx_voices_gender ON voices(gender);
CREATE INDEX IF NOT EXISTS idx_kb_agent_id ON knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_status ON knowledge_bases(status);
CREATE INDEX IF NOT EXISTS idx_chunks_kb_id ON document_chunks(kb_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 10. RLS POLICIES (Drop and recreate for idempotency)
-- =====================================================

-- USERS POLICIES
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Anyone can create users" ON users;
DROP POLICY IF EXISTS "Service role full access users" ON users;

CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Anyone can create users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access users" ON users
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- AGENTS POLICIES
DROP POLICY IF EXISTS "Users can read own agents" ON agents;
DROP POLICY IF EXISTS "Users can create own agents" ON agents;
DROP POLICY IF EXISTS "Users can update own agents" ON agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON agents;
DROP POLICY IF EXISTS "Service role full access agents" ON agents;
DROP POLICY IF EXISTS "Anyone can read agents" ON agents;
DROP POLICY IF EXISTS "Anyone can create agents" ON agents;
DROP POLICY IF EXISTS "Anyone can update agents" ON agents;
DROP POLICY IF EXISTS "Anyone can delete agents" ON agents;

CREATE POLICY "Users can read own agents" ON agents
  FOR SELECT USING (user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can create own agents" ON agents
  FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE USING (user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE USING (user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

-- VOICES POLICIES
DROP POLICY IF EXISTS "Anyone can read system voices" ON voices;
DROP POLICY IF EXISTS "Users can read own custom voices" ON voices;
DROP POLICY IF EXISTS "Users can create custom voices" ON voices;
DROP POLICY IF EXISTS "Service role full access voices" ON voices;

CREATE POLICY "Anyone can read system voices" ON voices
  FOR SELECT USING (is_custom = false OR user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can create custom voices" ON voices
  FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.jwt()->>'role' = 'service_role');

-- KNOWLEDGE BASES POLICIES
DROP POLICY IF EXISTS "Users can read own kb" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can create kb for own agents" ON knowledge_bases;
DROP POLICY IF EXISTS "Service role full access kb" ON knowledge_bases;
DROP POLICY IF EXISTS "Anyone can read knowledge_bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Anyone can create knowledge_bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Anyone can update knowledge_bases" ON knowledge_bases;

CREATE POLICY "Users can read own kb" ON knowledge_bases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM agents WHERE agents.id = knowledge_bases.agent_id AND agents.user_id = auth.uid())
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Users can create kb for own agents" ON knowledge_bases
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM agents WHERE agents.id = knowledge_bases.agent_id AND agents.user_id = auth.uid())
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Users can update own kb" ON knowledge_bases
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM agents WHERE agents.id = knowledge_bases.agent_id AND agents.user_id = auth.uid())
    OR auth.jwt()->>'role' = 'service_role'
  );

-- DOCUMENT CHUNKS POLICIES
DROP POLICY IF EXISTS "Users can read own chunks" ON document_chunks;
DROP POLICY IF EXISTS "Service role full access chunks" ON document_chunks;
DROP POLICY IF EXISTS "Anyone can read document_chunks" ON document_chunks;
DROP POLICY IF EXISTS "Anyone can create document_chunks" ON document_chunks;

CREATE POLICY "Users can read own chunks" ON document_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases kb
      JOIN agents a ON a.id = kb.agent_id
      WHERE kb.id = document_chunks.kb_id AND a.user_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Users can create chunks" ON document_chunks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_bases kb
      JOIN agents a ON a.id = kb.agent_id
      WHERE kb.id = document_chunks.kb_id AND a.user_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

-- SESSIONS POLICIES
DROP POLICY IF EXISTS "Users can read own sessions" ON sessions;
DROP POLICY IF EXISTS "Anyone can create sessions" ON sessions;
DROP POLICY IF EXISTS "Anyone can update sessions" ON sessions;
DROP POLICY IF EXISTS "Service role full access sessions" ON sessions;

CREATE POLICY "Users can read own sessions" ON sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM agents WHERE agents.id = sessions.agent_id AND agents.user_id = auth.uid())
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Anyone can create sessions" ON sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update sessions" ON sessions
  FOR UPDATE USING (true);

-- MESSAGES POLICIES
DROP POLICY IF EXISTS "Users can read own messages" ON messages;
DROP POLICY IF EXISTS "Anyone can create messages" ON messages;
DROP POLICY IF EXISTS "Service role full access messages" ON messages;

CREATE POLICY "Users can read own messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN agents a ON a.id = s.agent_id
      WHERE s.id = messages.session_id AND a.user_id = auth.uid()
    )
    OR auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "Anyone can create messages" ON messages
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- 11. TRIGGERS
-- =====================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables (drop first for idempotency)
DROP TRIGGER IF EXISTS set_users_updated_at ON users;
DROP TRIGGER IF EXISTS set_agents_updated_at ON agents;
DROP TRIGGER IF EXISTS set_kb_updated_at ON knowledge_bases;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_kb_updated_at
  BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Session duration trigger
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_session_duration ON sessions;
CREATE TRIGGER set_session_duration
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION calculate_session_duration();

-- =====================================================
-- 12. SEED DATA (Default Voices)
-- =====================================================

INSERT INTO voices (id, name, gender, style, is_custom) VALUES
  ('8ef4a238714b45718ce04243307c57a7', 'E Girl', 'female', 'playful', false),
  ('4a98f7c293ee44898705529cc8ccc7d6', 'Kawaii Female', 'female', 'cute', false),
  ('default-female', 'Professional Female', 'female', 'professional', false),
  ('default-male', 'Friendly Male', 'male', 'friendly', false),
  ('warm-female', 'Warm Female', 'female', 'warm', false),
  ('confident-male', 'Confident Male', 'male', 'confident', false),
  ('empathetic-female', 'Empathetic Female', 'female', 'empathetic', false),
  ('energetic-male', 'Energetic Male', 'male', 'energetic', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 13. PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agents TO authenticated;
GRANT SELECT ON voices TO authenticated;
GRANT SELECT, INSERT ON knowledge_bases TO authenticated;
GRANT SELECT, INSERT ON document_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sessions TO authenticated;
GRANT SELECT, INSERT ON messages TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =====================================================
-- 14. DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Platform users with authentication';
COMMENT ON TABLE agents IS 'AI voice agents owned by users';
COMMENT ON TABLE voices IS 'Available voices (system + custom)';
COMMENT ON TABLE knowledge_bases IS 'Knowledge sources for agents';
COMMENT ON TABLE document_chunks IS 'Chunked content for RAG retrieval';
COMMENT ON TABLE sessions IS 'Voice conversation sessions';
COMMENT ON TABLE messages IS 'Individual messages in sessions';

-- =====================================================
-- SCHEMA COMPLETE - Safe to run multiple times
-- =====================================================
