-- Existing memories keep their current rating, including a deliberately cleared rating.
ALTER TABLE "memories" ADD COLUMN "rating_manually_set" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "memories" ALTER COLUMN "rating_manually_set" SET DEFAULT false;
