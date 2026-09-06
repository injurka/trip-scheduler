CREATE TYPE "public"."track_activity_type" AS ENUM('still', 'walk', 'bike', 'vehicle', 'rail', 'unknown');--> statement-breakpoint
CREATE TABLE "track_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_point_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"ts_utc" timestamp with time zone NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"altitude" real,
	"accuracy" real,
	"speed" real,
	"bearing" real,
	"activity" "track_activity_type" DEFAULT 'unknown' NOT NULL,
	"activity_confidence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_points_client_point_id_unique" UNIQUE("client_point_id")
);
--> statement-breakpoint
CREATE TABLE "track_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"activity" "track_activity_type" NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"distance_m" real DEFAULT 0 NOT NULL,
	"point_count" integer DEFAULT 0 NOT NULL,
	"geometry" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_points" ADD CONSTRAINT "track_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_segments" ADD CONSTRAINT "track_segments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_points_user_ts_idx" ON "track_points" USING btree ("user_id","ts_utc");--> statement-breakpoint
CREATE INDEX "track_points_session_idx" ON "track_points" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "track_segments_user_session_idx" ON "track_segments" USING btree ("user_id","session_id","started_at");