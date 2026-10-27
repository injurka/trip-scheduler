CREATE TABLE "storage_cleanup_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prefix" text,
	"upload_id" text,
	"keep_if_media_url" text,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE INDEX "storage_cleanup_available_idx" ON "storage_cleanup_tasks" USING btree ("available_at");