-- Migration 005: Custom Face & Custom Voice
-- Adds support for photo-based avatar faces (Simli) and voice cloning (Fish Audio)

ALTER TABLE public.agents
  ADD COLUMN custom_face_id TEXT DEFAULT NULL,
  ADD COLUMN custom_face_status TEXT NOT NULL DEFAULT 'none'
    CHECK (custom_face_status IN ('none', 'uploading', 'processing', 'ready', 'failed')),
  ADD COLUMN custom_face_image_url TEXT DEFAULT NULL,
  ADD COLUMN custom_voice_id TEXT DEFAULT NULL,
  ADD COLUMN custom_voice_status TEXT NOT NULL DEFAULT 'none'
    CHECK (custom_voice_status IN ('none', 'uploading', 'processing', 'ready', 'failed')),
  ADD COLUMN custom_voice_name TEXT DEFAULT NULL,
  ADD COLUMN voice_type TEXT NOT NULL DEFAULT 'default'
    CHECK (voice_type IN ('default', 'cloned', 'gallery')),
  ADD COLUMN voice_sample_url TEXT DEFAULT NULL,
  ADD COLUMN face_consent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN voice_consent_at TIMESTAMPTZ DEFAULT NULL;

-- Storage buckets for uploaded assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('agent-faces', 'agent-faces', false, 5242880, ARRAY['image/jpeg', 'image/png']),
  ('voice-samples', 'voice-samples', false, 10485760, ARRAY['audio/wav', 'audio/mpeg', 'audio/webm', 'audio/mp4', 'audio/x-m4a'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for agent-faces bucket
CREATE POLICY "Users can upload face images for their agents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agent-faces'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read their own face images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agent-faces'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own face images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'agent-faces'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.agents WHERE user_id = auth.uid()
    )
  );

-- RLS policies for voice-samples bucket
CREATE POLICY "Users can upload voice samples for their agents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-samples'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read their own voice samples"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-samples'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.agents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own voice samples"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-samples'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.agents WHERE user_id = auth.uid()
    )
  );
