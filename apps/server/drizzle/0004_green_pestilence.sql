ALTER TABLE "memories" ADD COLUMN "rating" integer;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;