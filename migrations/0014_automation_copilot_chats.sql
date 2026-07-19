-- User-scoped saved Copilot chats for the Automation Builder
CREATE TABLE IF NOT EXISTS automation_copilot_chats (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled chat',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  automation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_copilot_chats_user_id_idx
  ON automation_copilot_chats (user_id);

CREATE INDEX IF NOT EXISTS automation_copilot_chats_user_updated_idx
  ON automation_copilot_chats (user_id, updated_at DESC);
