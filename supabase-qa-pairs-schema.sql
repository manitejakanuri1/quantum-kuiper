-- Create qa_pairs table for admin panel
-- This table stores curated question-answer pairs for each agent

CREATE TABLE IF NOT EXISTS public.qa_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    spoken_response TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_qa_pairs_agent_id ON public.qa_pairs(agent_id);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_priority ON public.qa_pairs(agent_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_keywords ON public.qa_pairs USING gin(keywords);

-- Enable Row Level Security (RLS)
ALTER TABLE public.qa_pairs ENABLE ROW LEVEL SECURITY;

-- Create policies for qa_pairs table
-- Allow authenticated users to read Q&A pairs
CREATE POLICY "Users can view Q&A pairs" ON public.qa_pairs
    FOR SELECT
    USING (true);

-- Allow authenticated users to insert Q&A pairs
CREATE POLICY "Users can insert Q&A pairs" ON public.qa_pairs
    FOR INSERT
    WITH CHECK (true);

-- Allow authenticated users to update Q&A pairs
CREATE POLICY "Users can update Q&A pairs" ON public.qa_pairs
    FOR UPDATE
    USING (true);

-- Allow authenticated users to delete Q&A pairs
CREATE POLICY "Users can delete Q&A pairs" ON public.qa_pairs
    FOR DELETE
    USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_qa_pairs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_qa_pairs_updated_at
    BEFORE UPDATE ON public.qa_pairs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_qa_pairs_updated_at();

-- Add comment to table
COMMENT ON TABLE public.qa_pairs IS 'Stores curated question-answer pairs for voice agents. Used by admin panel to manage pre-defined responses.';

-- Verify table creation
SELECT 'qa_pairs table created successfully!' as status;
