-- Optional JSON policy for business hours / VIP routing on inbound DID
ALTER TABLE "phone_numbers" ADD COLUMN IF NOT EXISTS "inbound_routing_policy" jsonb;
