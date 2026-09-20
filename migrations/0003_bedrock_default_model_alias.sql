-- Make `bedrock_default_model` use the central alias resolver so new agents
-- created from the DB default get a model id that works in any AWS region.
-- The literal id `anthropic.claude-3-5-sonnet-20241022-v2:0` is not a valid
-- inference profile in regions like me-central-1; the `claude-sonnet-4-6`
-- alias resolves (in `server/services/aws-bedrock.ts`) to a global
-- cross-region inference profile that works everywhere.

ALTER TABLE "aws_credentials"
  ALTER COLUMN "bedrock_default_model" SET DEFAULT 'claude-sonnet-4-6';

-- Backfill any existing rows still pinned to the old hardcoded id.
UPDATE "aws_credentials"
SET "bedrock_default_model" = 'claude-sonnet-4-6'
WHERE "bedrock_default_model" = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
