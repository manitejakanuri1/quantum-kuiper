-- Talk to Site — Foundation Schema
-- This migration creates the complete database schema for the Talk to Site platform.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'professional', 'business', 'enterprise')),
  plan_status TEXT NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing')),
  queries_today INTEGER NOT NULL DEFAULT 0,
  queries_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AGENTS (one per website)
-- ============================================
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'crawling', 'processing', 'ready', 'error')),

  -- Agent configuration
  greeting_message TEXT DEFAULT 'Hi! How can I help you today?',
  system_prompt TEXT DEFAULT 'You are a helpful customer support agent. Answer questions based only on the provided context. If you don''t know the answer, say so.',
  voice_id TEXT DEFAULT 'default',
  avatar_face_id TEXT DEFAULT '0c2b8b04-5274-41f1-a21c-d5c98322efa9',
  avatar_enabled BOOLEAN NOT NULL DEFAULT true,
  avatar_duration_limit INTEGER NOT NULL DEFAULT 30,

  -- Widget customization
  widget_color TEXT DEFAULT '#1F4E79',
  widget_position TEXT DEFAULT 'bottom-right' CHECK (widget_position IN ('bottom-right', 'bottom-left')),
  widget_title TEXT DEFAULT 'Chat with us',

  -- Pinecone namespace (one per agent for multi-tenancy)
  pinecone_namespace TEXT UNIQUE,

  -- Crawl metadata
  pages_crawled INTEGER NOT NULL DEFAULT 0,
  chunks_created INTEGER NOT NULL DEFAULT 0,
  last_crawled_at TIMESTAMPTZ,
  crawl_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE BASE PAGES (crawled content)
-- ============================================
CREATE TABLE public.knowledge_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  page_title TEXT,
  markdown_content TEXT,
  content_hash TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'chunked', 'embedded', 'error')),
  error_message TEXT,
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(agent_id, source_url)
);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,

  -- Visitor info (anonymous)
  visitor_id TEXT NOT NULL,
  visitor_ip TEXT,
  visitor_user_agent TEXT,
  visitor_page_url TEXT,

  -- Conversation metadata
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  message_count INTEGER NOT NULL DEFAULT 0,

  -- Analytics
  resolved BOOLEAN,
  csat_rating INTEGER CHECK (csat_rating BETWEEN 1 AND 5),
  escalated BOOLEAN NOT NULL DEFAULT false,

  -- Cost tracking
  tts_characters INTEGER NOT NULL DEFAULT 0,
  stt_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  avatar_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  llm_input_tokens INTEGER NOT NULL DEFAULT 0,
  llm_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- MESSAGES (within conversations)
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- RAG metadata
  sources JSONB,
  cache_hit BOOLEAN DEFAULT false,
  retrieval_time_ms INTEGER,
  generation_time_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- USAGE TRACKING (daily aggregates)
-- ============================================
CREATE TABLE public.usage_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  queries_count INTEGER NOT NULL DEFAULT 0,
  conversations_count INTEGER NOT NULL DEFAULT 0,
  tts_characters BIGINT NOT NULL DEFAULT 0,
  stt_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  avatar_minutes NUMERIC(10,2) NOT NULL DEFAULT 0,
  llm_tokens BIGINT NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,

  UNIQUE(user_id, date)
);

-- ============================================
-- SUBSCRIPTIONS (Stripe sync)
-- ============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Agents
CREATE POLICY "Users can view own agents" ON public.agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create agents" ON public.agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agents" ON public.agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own agents" ON public.agents FOR DELETE USING (auth.uid() = user_id);

-- Knowledge pages (via agent ownership)
CREATE POLICY "Users can view own KB pages" ON public.knowledge_pages FOR SELECT
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage own KB pages" ON public.knowledge_pages FOR ALL
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

-- Conversations (via agent ownership)
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

-- Messages (via conversation → agent ownership)
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT
  USING (conversation_id IN (
    SELECT c.id FROM public.conversations c
    JOIN public.agents a ON c.agent_id = a.id
    WHERE a.user_id = auth.uid()
  ));

-- Usage
CREATE POLICY "Users can view own usage" ON public.usage_daily FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_knowledge_pages_agent_id ON public.knowledge_pages(agent_id);
CREATE INDEX idx_conversations_agent_id ON public.conversations(agent_id);
CREATE INDEX idx_conversations_started_at ON public.conversations(started_at DESC);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_usage_daily_user_date ON public.usage_daily(user_id, date DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Increment daily query counter (returns true if under limit)
CREATE OR REPLACE FUNCTION public.increment_query_count(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_queries INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT plan, queries_today INTO v_plan, v_queries FROM public.profiles WHERE id = p_user_id;

  v_limit := CASE v_plan
    WHEN 'starter' THEN 30
    WHEN 'growth' THEN 150
    WHEN 'professional' THEN 300
    WHEN 'business' THEN 1000
    WHEN 'enterprise' THEN 999999
    ELSE 30
  END;

  UPDATE public.profiles
  SET queries_today = CASE
    WHEN queries_reset_at::date < CURRENT_DATE THEN 1
    ELSE queries_today + 1
  END,
  queries_reset_at = CASE
    WHEN queries_reset_at::date < CURRENT_DATE THEN NOW()
    ELSE queries_reset_at
  END
  WHERE id = p_user_id;

  RETURN v_queries < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
