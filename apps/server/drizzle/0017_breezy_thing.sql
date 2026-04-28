CREATE TYPE "public"."destination_type" AS ENUM('country', 'city');--> statement-breakpoint
CREATE TABLE "countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text
);
--> statement-breakpoint
CREATE TABLE "destination_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "destination_type" NOT NULL,
	"country_id" text NOT NULL,
	"city" text,
	"cover_url" text,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"content" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dest_reviews_type_idx" ON "destination_reviews" USING btree ("type");--> statement-breakpoint
CREATE INDEX "dest_reviews_country_idx" ON "destination_reviews" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "dest_reviews_user_idx" ON "destination_reviews" USING btree ("user_id");