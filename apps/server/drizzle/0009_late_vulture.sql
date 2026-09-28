ALTER TABLE "trips" ADD COLUMN "share_slug" text;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_share_slug_unique" UNIQUE("share_slug");