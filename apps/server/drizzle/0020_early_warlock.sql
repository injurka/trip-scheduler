ALTER TABLE "push_tokens" ADD COLUMN "provider" text DEFAULT 'rustore' NOT NULL;--> statement-breakpoint
CREATE INDEX "push_tokens_provider_user_idx" ON "push_tokens" USING btree ("provider","user_id");
