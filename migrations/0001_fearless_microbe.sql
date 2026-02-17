CREATE TABLE "call_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" varchar NOT NULL,
	"question_id" text NOT NULL,
	"question_text" text NOT NULL,
	"answer_type" text DEFAULT 'BOOLEAN' NOT NULL,
	"answer_value" text NOT NULL,
	"is_concern" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "human_incoming_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"phone_number_id" varchar NOT NULL,
	"transfer_number" text NOT NULL,
	"transfer_target_type" text DEFAULT 'phone' NOT NULL,
	"ivr_enabled" boolean DEFAULT true NOT NULL,
	"ivr_greeting" text,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "human_incoming_connections_phone_number_id_unique" UNIQUE("phone_number_id")
);
--> statement-breakpoint
CREATE TABLE "integration_apps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"category" text,
	"logo_url" text,
	"n8n_node_type" text NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "integration_sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" varchar NOT NULL,
	"n8n_execution_id" text,
	"event_type" text,
	"status" text,
	"records_synced" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"execution_duration_ms" integer,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"app_id" varchar NOT NULL,
	"n8n_workflow_id" text NOT NULL,
	"n8n_credential_id" text NOT NULL,
	"webhook_url" text NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"config" jsonb,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "knowledge_base_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "voice_provider" text DEFAULT 'elevenlabs';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "aws_polly_voice_id" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "aws_polly_engine" text DEFAULT 'neural';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "aws_credential_id" varchar;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "channel_type" text DEFAULT 'VOICE';--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "cost" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "end_reason" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "session_outcome" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "end_to_end_latency_ms" integer;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "number_type" text DEFAULT 'local';--> statement-breakpoint
ALTER TABLE "call_responses" ADD CONSTRAINT "call_responses_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_incoming_connections" ADD CONSTRAINT "human_incoming_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_incoming_connections" ADD CONSTRAINT "human_incoming_connections_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sync_logs" ADD CONSTRAINT "integration_sync_logs_integration_id_user_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."user_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_app_id_integration_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."integration_apps"("id") ON DELETE cascade ON UPDATE no action;