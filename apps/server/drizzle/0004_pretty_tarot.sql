CREATE TABLE "post_whitelist" (
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_whitelist_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "post_media" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "post_whitelist" ADD CONSTRAINT "post_whitelist_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_whitelist" ADD CONSTRAINT "post_whitelist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_whitelist_post_id_idx" ON "post_whitelist" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_whitelist_user_id_idx" ON "post_whitelist" USING btree ("user_id");