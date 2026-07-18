-- ElevenLabs voice quality controls + optional model override
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS voice_style double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voice_speaker_boost boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS eleven_labs_model_id text;

-- Feature flag: post-call Audio Isolation on recordings (default off)
INSERT INTO global_settings (id, key, value, description, updated_at)
VALUES (
  gen_random_uuid(),
  'elevenlabs_audio_isolation_on_recordings',
  'false'::jsonb,
  'When true, run ElevenLabs Audio Isolation on call recordings after they are saved (extra cost/latency).',
  NOW()
)
ON CONFLICT (key) DO NOTHING;
