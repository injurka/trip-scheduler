CREATE TYPE "public"."activity_section_type" AS ENUM('description', 'gallery', 'geolocation', 'metro');--> statement-breakpoint
CREATE TYPE "public"."activity_status" AS ENUM('none', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."activity_tag" AS ENUM('activity', 'transport', 'walk', 'food', 'attraction', 'relax');--> statement-breakpoint
CREATE TYPE "public"."comment_parent_type" AS ENUM('trip', 'day');--> statement-breakpoint
CREATE TYPE "public"."destination_type" AS ENUM('country', 'city');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('folder', 'markdown', 'excalidraw');--> statement-breakpoint
CREATE TYPE "public"."post_media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('completed', 'planned', 'draft');--> statement-breakpoint
CREATE TYPE "public"."trip_image_placement" AS ENUM('route', 'memories', 'notes', 'documents');--> statement-breakpoint
CREATE TYPE "public"."trip_section_type" AS ENUM('bookings', 'finances', 'checklist', 'documents', 'notes', 'memories');--> statement-breakpoint
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
	"day_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"cover_image" text,
	"published_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blogs_slug_unique" UNIQUE("slug")
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
CREATE TABLE "countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"flagUrl" text
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"note" text,
	"trip_id" uuid NOT NULL,
	"meta" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"email" text,
	"name" text NOT NULL,
	"password" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_verification_tokens_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"country_id" text NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"comment" text,
	"latitude" real,
	"longitude" real,
	"taken_at" timestamp,
	"width" integer,
	"height" integer,
	"variants" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rating" integer,
	"tags" jsonb DEFAULT '[]'::jsonb
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
	"line_number" text,
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
CREATE TABLE "post_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"title" text,
	"day" integer DEFAULT 1 NOT NULL,
	"time" text,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_likes_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"url" text NOT NULL,
	"type" "post_media_type" DEFAULT 'image' NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"taken_at" timestamp,
	"latitude" real,
	"longitude" real,
	"width" integer,
	"height" integer,
	"variants" jsonb,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"insight" text,
	"description" text,
	"country" text,
	"start_date" date,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "status" DEFAULT 'draft' NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"saves_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"latitude" real,
	"longitude" real,
	"stats_detail" jsonb DEFAULT '{"views":0,"duration":0}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "saved_posts" (
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_posts_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
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
CREATE TABLE "trip_note_images" (
	"note_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	CONSTRAINT "trip_note_images_note_id_image_id_pk" PRIMARY KEY("note_id","image_id")
);
--> statement-breakpoint
CREATE TABLE "trip_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"parent_id" uuid,
	"type" "note_type" NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"color" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "trip_subscriptions" (
	"user_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_subscriptions_user_id_trip_id_pk" PRIMARY KEY("user_id","trip_id")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"description" text,
	"description_short" text,
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
	"email" text,
	"email_verified" timestamp with time zone,
	"password" text,
	"name" text,
	"avatar_url" text,
	"cover_url" text,
	"github_id" text,
	"google_id" text,
	"telegram_id" text,
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
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_token_usage" ADD CONSTRAINT "llm_token_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_token_usage" ADD CONSTRAINT "llm_token_usage_model_llm_models_id_fk" FOREIGN KEY ("model") REFERENCES "public"."llm_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_image_id_trip_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."trip_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_activity_id_activities_id_fk" FOREIGN KEY ("source_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_line_stations" ADD CONSTRAINT "metro_line_stations_line_id_metro_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."metro_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_line_stations" ADD CONSTRAINT "metro_line_stations_station_id_metro_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."metro_stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_lines" ADD CONSTRAINT "metro_lines_system_id_metro_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."metro_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_stations" ADD CONSTRAINT "metro_stations_system_id_metro_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."metro_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_elements" ADD CONSTRAINT "post_elements_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_posts" ADD CONSTRAINT "saved_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_images" ADD CONSTRAINT "trip_images_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_note_images" ADD CONSTRAINT "trip_note_images_note_id_trip_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."trip_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_note_images" ADD CONSTRAINT "trip_note_images_image_id_trip_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."trip_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notes" ADD CONSTRAINT "trip_notes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notes" ADD CONSTRAINT "trip_notes_parent_id_trip_notes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trip_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_sections" ADD CONSTRAINT "trip_sections_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_subscriptions" ADD CONSTRAINT "trip_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_subscriptions" ADD CONSTRAINT "trip_subscriptions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parent_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "dest_reviews_type_idx" ON "destination_reviews" USING btree ("type");--> statement-breakpoint
CREATE INDEX "dest_reviews_country_idx" ON "destination_reviews" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "dest_reviews_user_idx" ON "destination_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_email_idx" ON "email_verification_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "highlights_country_idx" ON "highlights" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "highlights_user_idx" ON "highlights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "llm_usage_user_id_idx" ON "llm_token_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "post_elements_post_id_idx" ON "post_elements" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_media_post_id_idx" ON "post_media" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "posts_country_idx" ON "posts" USING btree ("country");--> statement-breakpoint
CREATE INDEX "posts_tags_idx" ON "posts" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "trip_notes_parent_idx" ON "trip_notes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "trip_notes_trip_idx" ON "trip_notes" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");