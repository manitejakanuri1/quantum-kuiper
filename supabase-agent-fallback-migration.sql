-- =====================================================
-- ADD FALLBACK MESSAGE SUPPORT TO AGENTS TABLE
-- =====================================================

-- Add fallback_message column to agents table
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS fallback_message TEXT DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.agents.fallback_message IS
'Custom fallback message when agent cannot answer a question. If NULL, uses generic fallback: "I don''t have that information in my knowledge base."';

-- Example: Set default fallback for existing agents (optional)
-- UPDATE public.agents
-- SET fallback_message = 'I don''t have that specific information right now, but feel free to ask me something else!'
-- WHERE fallback_message IS NULL;

-- Verify column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'agents' AND column_name = 'fallback_message';

SELECT '✅ Fallback message column added to agents table' as status;
