-- SMS Messaging Panel
--
-- Adds:
--   1. `conversations.peer_phone_e164` — channel-agnostic peer phone number,
--      required for channel='sms' rows (WhatsApp rows continue using
--      contact_id → whatsapp_contacts).
--   2. `messages.num_segments` / `messages.destination_country` /
--      `messages.credits_charged` — populated by sms-service when sending and
--      reconciled from Twilio status callbacks.
--   3. `workspace_sms_settings` — per-workspace SMS sender configuration
--      (phone number vs Messaging Service SID) plus compliance state.
--   4. `sms_country_rates` — admin-managed per-country credit rates with a
--      single iso_country='*' row used as the global fallback.

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "peer_phone_e164" text;

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "num_segments" integer,
  ADD COLUMN IF NOT EXISTS "destination_country" varchar(2),
  ADD COLUMN IF NOT EXISTS "credits_charged" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "workspace_sms_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" varchar NOT NULL UNIQUE REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "sender_type" text NOT NULL DEFAULT 'phone_number',
  "phone_number_id" varchar REFERENCES "phone_numbers"("id") ON DELETE SET NULL,
  "messaging_service_sid" text,
  "inbound_webhook_configured" boolean NOT NULL DEFAULT false,
  "compliance_status" text NOT NULL DEFAULT 'unknown',
  "last_compliance_check_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sms_country_rates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "iso_country" varchar(2) NOT NULL UNIQUE,
  "credits_per_segment" integer NOT NULL,
  "label" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Seed the global default rate. Customers can edit this in the admin panel.
-- Currency-neutral: 1 credit = whatever a credit costs on the platform.
INSERT INTO "sms_country_rates" ("iso_country", "credits_per_segment", "label", "is_default")
VALUES ('*', 2, 'Default (fallback)', true)
ON CONFLICT ("iso_country") DO NOTHING;

-- Indexes for the conversations / messages tables to speed up
-- the /api/sms/conversations and /api/sms/conversations/:id/messages queries.
CREATE INDEX IF NOT EXISTS "idx_conversations_workspace_channel"
  ON "conversations" ("workspace_id", "channel", "last_message_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_messages_conversation_created"
  ON "messages" ("conversation_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_messages_twilio_sid"
  ON "messages" ("twilio_message_sid")
  WHERE "twilio_message_sid" IS NOT NULL;
