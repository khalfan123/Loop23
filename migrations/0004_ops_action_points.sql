DO $$ BEGIN
  ALTER TYPE "public"."ops_task_type" ADD VALUE IF NOT EXISTS 'appointment';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."ops_task_type" ADD VALUE IF NOT EXISTS 'dynamic_form';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "ops_tasks" ADD COLUMN IF NOT EXISTS "action_target" jsonb;
--> statement-breakpoint
ALTER TABLE "ops_analysis_runs" ADD COLUMN IF NOT EXISTS "output_language" text;
--> statement-breakpoint
ALTER TABLE "ops_analysis_runs" ADD COLUMN IF NOT EXISTS "provider" text;
--> statement-breakpoint
ALTER TABLE "ops_analysis_runs" ADD COLUMN IF NOT EXISTS "model_used" text;
--> statement-breakpoint
ALTER TABLE "ops_analysis_runs" ADD COLUMN IF NOT EXISTS "call_summary" text;
--> statement-breakpoint
ALTER TABLE "ops_analysis_runs" ADD COLUMN IF NOT EXISTS "call_brief" jsonb;
