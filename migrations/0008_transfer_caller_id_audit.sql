-- Persist UAE-safe transfer caller ID resolution on every transferred call
-- so Live Monitoring + Call Detail can show "Transfer CLI: +44… (env)" or
-- "(omitted — UAE-only DID)" without grepping logs. Source labels are
-- 'wizard' | 'env' | 'inbound' | 'omitted' (see resolveHumanAgentBridgeCallerId).

ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "transfer_caller_id" text,
  ADD COLUMN IF NOT EXISTS "transfer_caller_id_source" text;

ALTER TABLE "twilio_openai_calls"
  ADD COLUMN IF NOT EXISTS "transfer_caller_id" text,
  ADD COLUMN IF NOT EXISTS "transfer_caller_id_source" text;
