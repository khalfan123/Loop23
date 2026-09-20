-- Alphanumeric Sender ID support
--
-- Adds the `alphanumeric_sender` column to `workspace_sms_settings`. When
-- senderType='alphanumeric', the workspace sends outbound SMS using a branded
-- string (e.g. "B24 Payment") as the `from` value on Twilio messages.create.
-- One-way only — recipients cannot reply. Not supported in US, Canada, China,
-- Vietnam (enforced in sms-service before the Twilio call).
--
-- The existing `sender_type` column stays a free-form text and now accepts the
-- third value 'alphanumeric' in addition to 'phone_number' / 'messaging_service'.

ALTER TABLE "workspace_sms_settings"
  ADD COLUMN IF NOT EXISTS "alphanumeric_sender" text;
