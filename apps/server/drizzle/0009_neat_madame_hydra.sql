ALTER TABLE "posts" ADD COLUMN "latitude" real;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "longitude" real;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "stats_detail" jsonb DEFAULT '{"views":0,"budget":"","duration":""}'::jsonb NOT NULL;