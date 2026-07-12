-- Outbound caller ID (Twilio-owned non-UAE) for Human Agent <Dial> bridge leg
ALTER TABLE "human_incoming_connections" ADD COLUMN IF NOT EXISTS "outbound_caller_phone_number_id" varchar;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'human_incoming_connections_outbound_caller_phone_number_id_phone_numbers_id_fk'
  ) THEN
    ALTER TABLE "human_incoming_connections"
      ADD CONSTRAINT "human_incoming_connections_outbound_caller_phone_number_id_phone_numbers_id_fk"
      FOREIGN KEY ("outbound_caller_phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
