-- Phase 3 Instant Clone: consent + sample metadata + profile IDs
CREATE TABLE IF NOT EXISTS voice_clone_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider_profile_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  language text DEFAULT 'en',
  consent_accepted_at timestamp NOT NULL,
  consent_version text NOT NULL,
  consent_ip text,
  sample_path text,
  sample_mime_type text,
  sample_bytes integer,
  error_message text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_clone_profiles_user_id_idx ON voice_clone_profiles(user_id);

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS local_clone_voice_id text;
