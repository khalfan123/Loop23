-- Native calendar OAuth connections (Google / Microsoft)
CREATE TABLE IF NOT EXISTS "calendar_connections" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "provider" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "scope" text,
  "token_type" text,
  "expires_at" timestamp,
  "calendar_id" text DEFAULT 'primary',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "calendar_connections_user_provider_unique"
  ON "calendar_connections" ("user_id", "provider");

CREATE TABLE IF NOT EXISTS "calendar_oauth_states" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
  "provider" text NOT NULL,
  "state" text NOT NULL UNIQUE,
  "code_verifier" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "calendar_oauth_states_created_at_idx"
  ON "calendar_oauth_states" ("created_at");

