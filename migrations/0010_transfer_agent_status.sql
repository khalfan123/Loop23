-- Task #32: persist the final disposition of the human-agent bridged leg
-- ('answered' | 'no-answer' | 'busy' | 'failed' | 'canceled') so call history
-- and live monitoring can show whether the human agent actually answered each
-- transfer. Populated from the hop2 status callback (relay → agent leg) and
-- from the single-leg <Dial> action callback. NULL while ringing or for
-- non-transferred calls.

ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "transfer_agent_status" text;

ALTER TABLE "twilio_openai_calls"
  ADD COLUMN IF NOT EXISTS "transfer_agent_status" text;
