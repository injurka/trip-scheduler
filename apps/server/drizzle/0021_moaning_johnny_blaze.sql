ALTER TABLE "highlights" ADD COLUMN "taken_at" timestamp;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "variants" jsonb;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "metadata" jsonb;