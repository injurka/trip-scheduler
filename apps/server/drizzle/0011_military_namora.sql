ALTER TABLE "email_verification_tokens" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "stats_detail" SET DEFAULT '{"views":0,"duration":0}'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "post_elements" ADD COLUMN "day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "post_elements" ADD COLUMN "time" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "start_date" date;