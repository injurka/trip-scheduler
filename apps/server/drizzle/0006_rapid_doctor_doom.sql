CREATE TABLE "city_weather_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_normalized" text NOT NULL,
	"month" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "weather_data" jsonb;--> statement-breakpoint
CREATE INDEX "city_weather_cache_city_month_idx" ON "city_weather_cache" USING btree ("city_normalized","month");