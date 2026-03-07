CREATE TABLE "post_likes" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "post_media" DROP CONSTRAINT "post_media_element_id_post_elements_id_fk";
--> statement-breakpoint
DROP INDEX "post_images_post_id_idx";--> statement-breakpoint
DROP INDEX "post_images_element_id_idx";--> statement-breakpoint
DROP INDEX "posts_city_idx";--> statement-breakpoint
ALTER TABLE "post_media" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_media_post_id_idx" ON "post_media" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "posts_country_idx" ON "posts" USING btree ("country");--> statement-breakpoint
ALTER TABLE "post_media" DROP COLUMN "element_id";