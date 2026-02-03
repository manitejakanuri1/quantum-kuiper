-- =====================================================
-- ADD ANSWER SOURCE TRACKING TO USER_QUESTIONS TABLE
-- =====================================================

-- Add answer_source column to user_questions table
ALTER TABLE public.user_questions
ADD COLUMN IF NOT EXISTS answer_source TEXT DEFAULT 'vector_search';

-- Add comment
COMMENT ON COLUMN public.user_questions.answer_source IS
'Source of answer: qa_exact (90%+ match), qa_semantic (70-90%), vector_search (<70%), fallback (no match), error (system error)';

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_questions_source
ON public.user_questions(agent_id, answer_source);

-- Verify column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_questions' AND column_name = 'answer_source';

-- Show sample analytics query
SELECT '✅ Answer source column added to user_questions table' as status;

-- Sample analytics query (informational only, not executed)
/*
SELECT
    answer_source,
    COUNT(*) as question_count,
    AVG(confidence) as avg_confidence,
    SUM(CASE WHEN was_successful THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as success_rate
FROM user_questions
WHERE agent_id = 'your-agent-id'
GROUP BY answer_source
ORDER BY question_count DESC;
*/
