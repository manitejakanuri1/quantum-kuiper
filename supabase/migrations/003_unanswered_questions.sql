-- Unanswered Questions — Knowledge gap tracking
-- Logs queries where RAG pipeline couldn't find a confident answer
-- Used for dashboard "Knowledge Gaps" feature

CREATE TABLE IF NOT EXISTS public.unanswered_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  question text NOT NULL,
  best_similarity_score real DEFAULT 0,
  times_asked integer DEFAULT 1,
  answer text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_unanswered_agent ON public.unanswered_questions(agent_id);
CREATE INDEX idx_unanswered_times ON public.unanswered_questions(times_asked DESC);

ALTER TABLE public.unanswered_questions ENABLE ROW LEVEL SECURITY;

-- Users can view unanswered questions for their own agents
CREATE POLICY "Users can view their agents unanswered questions"
  ON public.unanswered_questions FOR SELECT
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

-- Service role has full access (for converse endpoint logging)
CREATE POLICY "Service role full access to unanswered_questions"
  ON public.unanswered_questions FOR ALL
  USING (true)
  WITH CHECK (true);
