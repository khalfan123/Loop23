-- Task #31: ordered list of relay phone number IDs for automatic fallback
-- when the primary relay fails (rate-limited, suspended, busy, no-answer, etc.).
-- The legacy single-id column `relay_phone_number_id` is preserved for
-- back-compat; the server prefers `relay_phone_number_ids` when non-empty
-- and falls back to the legacy column otherwise.

ALTER TABLE "human_incoming_connections"
  ADD COLUMN IF NOT EXISTS "relay_phone_number_ids" text[];
