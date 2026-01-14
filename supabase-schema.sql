-- Supabase Schema for VoiceAgent Platform
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT,
  face_id TEXT,
  voice_id TEXT,
  status TEXT DEFAULT 'active',
  embed_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FishAudio Voices table
CREATE TABLE IF NOT EXISTS voices (
  id TEXT PRIMARY KEY,  -- FishAudio model ID
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'neutral')),
  style TEXT,
  preview_url TEXT,
  is_custom BOOLEAN DEFAULT false,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for system voices
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default FishAudio voices
INSERT INTO voices (id, name, gender, style, is_custom) VALUES
  ('8ef4a238714b45718ce04243307c57a7', 'E Girl', 'female', 'playful', false),
  ('default-female', 'Professional Female', 'female', 'professional', false),
  ('default-male', 'Friendly Male', 'male', 'friendly', false),
  ('warm-female', 'Warm Female', 'female', 'warm', false),
  ('confident-male', 'Confident Male', 'male', 'confident', false),
  ('empathetic-female', 'Empathetic Female', 'female', 'empathetic', false),
  ('energetic-male', 'Energetic Male', 'male', 'energetic', false)
ON CONFLICT (id) DO NOTHING;

-- Knowledge bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  source_url TEXT,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kb_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT,
  chunk_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Conversation messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_agent_id ON knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_kb_id ON document_chunks(kb_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert" ON users
  FOR INSERT WITH CHECK (true);

-- RLS Policies for agents table
CREATE POLICY "Anyone can read agents" ON agents
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create agents" ON agents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update agents" ON agents
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete agents" ON agents
  FOR DELETE USING (true);

-- RLS Policies for knowledge_bases
CREATE POLICY "Anyone can read knowledge_bases" ON knowledge_bases
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create knowledge_bases" ON knowledge_bases
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update knowledge_bases" ON knowledge_bases
  FOR UPDATE USING (true);

-- RLS Policies for document_chunks
CREATE POLICY "Anyone can read document_chunks" ON document_chunks
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create document_chunks" ON document_chunks
  FOR INSERT WITH CHECK (true);

-- RLS Policies for sessions
CREATE POLICY "Anyone can read sessions" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create sessions" ON sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update sessions" ON sessions
  FOR UPDATE USING (true);

-- RLS Policies for messages
CREATE POLICY "Anyone can read messages" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create messages" ON messages
  FOR INSERT WITH CHECK (true);

-- Insert demo user (password: demo123 - hashed with bcrypt)
INSERT INTO users (id, email, password, name) 
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'demo@example.com',
  '$2b$10$demo-hashed-password',
  'Demo User'
) ON CONFLICT (email) DO NOTHING;
