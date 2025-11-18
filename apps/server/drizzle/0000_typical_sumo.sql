CREATE TYPE "public"."activity_section_type" AS ENUM('description', 'gallery', 'geolocation', 'metro');--> statement-breakpoint
CREATE TYPE "public"."activity_status" AS ENUM('none', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."activity_tag" AS ENUM('transport', 'walk', 'food', 'attraction', 'relax');--> statement-breakpoint
CREATE TYPE "public"."comment_parent_type" AS ENUM('trip', 'day');--> statement-breakpoint
CREATE TYPE "public"."community_member_role" AS ENUM('admin', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."community_privacy" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('completed', 'planned', 'draft');--> statement-breakpoint
CREATE TYPE "public"."trip_image_placement" AS ENUM('route', 'memories');--> statement-breakpoint
CREATE TYPE "public"."trip_section_type" AS ENUM('bookings', 'finances', 'checklist', 'notes');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"title" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tag" "activity_tag",
	"status" "activity_status" DEFAULT 'none' NOT NULL,
	"rating" integer,
	"day_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"parent_type" "comment_parent_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cover_image_url" text,
	"avatar_url" text,
	"privacy_type" "community_privacy" DEFAULT 'public' NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"community_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "community_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_members_community_id_user_id_pk" PRIMARY KEY("community_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"trip_id" uuid NOT NULL,
	"meta" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_verification_tokens_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "llm_models" (
	"id" text PRIMARY KEY NOT NULL,
	"cost_per_million_input_tokens" real DEFAULT 0 NOT NULL,
	"cost_per_million_output_tokens" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_token_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"model" text NOT NULL,
	"operation" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"timestamp" timestamp,
	"comment" text,
	"image_id" uuid,
	"title" text,
	"tag" "activity_tag",
	"source_activity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metro_line_stations" (
	"line_id" text NOT NULL,
	"station_id" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "metro_line_stations_line_id_station_id_pk" PRIMARY KEY("line_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "metro_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"system_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metro_stations" (
	"id" text PRIMARY KEY NOT NULL,
	"system_id" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metro_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	CONSTRAINT "metro_systems_city_unique" UNIQUE("city")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"max_trips" integer DEFAULT 1 NOT NULL,
	"max_storage_bytes" bigint DEFAULT 1073741824 NOT NULL,
	"monthly_llm_credits" bigint DEFAULT 100000 NOT NULL,
	"is_developing" boolean DEFAULT false NOT NULL,
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "trip_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"url" text NOT NULL,
	"placement" "trip_image_placement" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"taken_at" timestamp,
	"latitude" real,
	"longitude" real,
	"width" integer,
	"height" integer,
	"variants" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "trip_participants" (
	"trip_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "trip_participants_trip_id_user_id_pk" PRIMARY KEY("trip_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "trip_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"type" "trip_section_type" NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"content" jsonb DEFAULT '{}',
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"cities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "status" DEFAULT 'draft' NOT NULL,
	"budget" real,
	"currency" text DEFAULT 'RUB',
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"password" text,
	"name" text,
	"avatar_url" text,
	"github_id" text,
	"google_id" text,
	"plan_id" integer DEFAULT 1 NOT NULL,
	"current_trips_count" integer DEFAULT 0 NOT NULL,
	"current_storage_bytes" bigint DEFAULT 0 NOT NULL,
	"llm_credits_used" bigint DEFAULT 0 NOT NULL,
	"llm_credits_period_start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status_text" text,
	"status_emoji" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_token_usage" ADD CONSTRAINT "llm_token_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_token_usage" ADD CONSTRAINT "llm_token_usage_model_llm_models_id_fk" FOREIGN KEY ("model") REFERENCES "public"."llm_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_image_id_trip_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."trip_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_activity_id_activities_id_fk" FOREIGN KEY ("source_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_line_stations" ADD CONSTRAINT "metro_line_stations_line_id_metro_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."metro_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_line_stations" ADD CONSTRAINT "metro_line_stations_station_id_metro_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."metro_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_lines" ADD CONSTRAINT "metro_lines_system_id_metro_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."metro_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_stations" ADD CONSTRAINT "metro_stations_system_id_metro_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."metro_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_images" ADD CONSTRAINT "trip_images_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_sections" ADD CONSTRAINT "trip_sections_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parent_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "verification_email_idx" ON "email_verification_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "llm_usage_user_id_idx" ON "llm_token_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");