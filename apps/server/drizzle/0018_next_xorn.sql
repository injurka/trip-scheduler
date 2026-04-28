CREATE TABLE "highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"country" text NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"comment" text,
	"latitude" real,
	"longitude" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;