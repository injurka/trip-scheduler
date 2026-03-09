CREATE TABLE "marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"category_id" integer DEFAULT 1 NOT NULL,
	"start_at" timestamp with time zone,
	"duration" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;