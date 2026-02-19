-- Add prompt generation columns to agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS extracted_info JSONB DEFAULT NULL;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS prompt_generated_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS prompt_customized BOOLEAN DEFAULT false;
