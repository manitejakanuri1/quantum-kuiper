-- Create user_questions table to store questions asked by users
-- This helps identify gaps in Q&A coverage and improve agent responses

CREATE TABLE IF NOT EXISTS public.user_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer_given TEXT,
    confidence NUMERIC(5,2),
    was_successful BOOLEAN DEFAULT false,
    user_session_id TEXT,
    answer_source TEXT DEFAULT 'vector_search',
    asked_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_questions_agent_id ON public.user_questions(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_asked_at ON public.user_questions(agent_id, asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_questions_unsuccessful ON public.user_questions(agent_id, was_successful) WHERE was_successful = false;
CREATE INDEX IF NOT EXISTS idx_user_questions_source ON public.user_questions(agent_id, answer_source);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_questions table
CREATE POLICY "Users can view user questions" ON public.user_questions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert user questions" ON public.user_questions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update user questions" ON public.user_questions
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete user questions" ON public.user_questions
    FOR DELETE USING (true);

-- Add comments to table and columns
COMMENT ON TABLE public.user_questions IS 'Stores questions asked by users to identify gaps in Q&A coverage and improve agent responses.';
COMMENT ON COLUMN public.user_questions.answer_source IS 'Source of answer: qa_exact (90%+ match), qa_semantic (70-90%), vector_search (<70%), fallback (no match), error (system error)';

-- Verify table creation
SELECT 'user_questions table created successfully!' as status;
