-- =====================================================
-- Voice Migration: Replace placeholder voices with realistic FishAudio voices
-- Safe to run in Supabase SQL Editor
-- =====================================================

-- Step 1: Remove old placeholder voices (these don't work with FishAudio API)
DELETE FROM voices WHERE id IN (
  'default-female',
  'default-male',
  'warm-female',
  'confident-male',
  'empathetic-female',
  'energetic-male'
);

-- Step 2: Insert new realistic voices
INSERT INTO voices (id, name, gender, style, is_custom) VALUES
  -- NEW REALISTIC VOICES (Primary - Human-like)
  ('1b160c4cf02e4855a09efd59475b9370', 'Sophia - Professional', 'female', 'professional', false),
  ('76f7e17483084df6b0f1bcecb5fb13e9', 'Marcus - Confident', 'male', 'confident', false),
  ('34b01f00fd8f4e12a664d1e081c13312', 'David - Friendly', 'male', 'friendly', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gender = EXCLUDED.gender,
  style = EXCLUDED.style;

-- Step 3: Ensure legacy voices are present (backward compatibility)
INSERT INTO voices (id, name, gender, style, is_custom) VALUES
  ('ab9f86c943514589a52c00f55088e1ae', 'E Girl - Playful', 'female', 'playful', false),
  ('4a98f7c293ee44898705529cc8ccc7d6', 'Kawaii - Cute', 'female', 'cute', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gender = EXCLUDED.gender,
  style = EXCLUDED.style;

-- Step 4: Update existing agents with deleted placeholder voice IDs
-- Female placeholder → Sophia (Professional)
UPDATE agents
SET voice_id = '1b160c4cf02e4855a09efd59475b9370'
WHERE voice_id IN ('default-female', 'warm-female', 'empathetic-female');

-- Male placeholder → Marcus (Confident)
UPDATE agents
SET voice_id = '76f7e17483084df6b0f1bcecb5fb13e9'
WHERE voice_id IN ('default-male', 'confident-male', 'energetic-male');

-- Step 5: Verify migration results
SELECT
  '✅ Migration complete!' AS status,
  COUNT(*) AS total_voices
FROM voices
WHERE is_custom = false;

-- Show all voices after migration
SELECT
  id,
  name,
  gender,
  style,
  is_custom,
  created_at
FROM voices
ORDER BY gender, name;

-- Show count of updated agents (if any)
SELECT
  voice_id,
  COUNT(*) AS agent_count
FROM agents
GROUP BY voice_id
ORDER BY agent_count DESC;

-- =====================================================
-- Expected Results:
-- - 5 system voices (3 new realistic + 2 legacy)
-- - All placeholder voices removed
-- - Existing agents updated to use realistic voices
-- =====================================================
