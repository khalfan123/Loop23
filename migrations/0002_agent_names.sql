CREATE TABLE IF NOT EXISTS "agent_names" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "language" text NOT NULL,
        "gender" text DEFAULT 'unisex' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_names_language" ON "agent_names" ("language");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_names_unique" ON "agent_names" ("language", "name");
