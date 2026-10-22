CREATE TYPE "public"."geo_catalog_version_state" AS ENUM('loading', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."geo_place_kind" AS ENUM('settlement', 'island', 'area');--> statement-breakpoint
CREATE TYPE "public"."geo_place_name_origin" AS ENUM('geonames_primary', 'geonames_ascii', 'geonames_alternate', 'app_override');--> statement-breakpoint
CREATE TYPE "public"."geo_resolution_status" AS ENUM('resolved', 'unresolved', 'needs_review');--> statement-breakpoint
CREATE TABLE "geo_catalog_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"manifest" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"state" "geo_catalog_version_state" DEFAULT 'loading' NOT NULL,
	"importer_version" text NOT NULL,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"downloaded_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_place_names" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"language" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"prefix_key" text NOT NULL,
	"origin" "geo_place_name_origin" NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"is_historical" boolean DEFAULT false NOT NULL,
	"source_name_id" text,
	"catalog_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_places" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'geonames' NOT NULL,
	"source_id" text NOT NULL,
	"country_id" text NOT NULL,
	"catalog_version" text,
	"feature_code" text NOT NULL,
	"kind" "geo_place_kind" DEFAULT 'settlement' NOT NULL,
	"primary_name" text NOT NULL,
	"ascii_name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"admin1_code" text,
	"admin2_code" text,
	"region_name" text,
	"timezone" text,
	"population" bigint DEFAULT 0 NOT NULL,
	"source_modified_at" date,
	"source_present_in_latest_subset" boolean DEFAULT true NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geo_places_latitude_range_check" CHECK ("geo_places"."latitude" >= -90 AND "geo_places"."latitude" <= 90),
	CONSTRAINT "geo_places_longitude_range_check" CHECK ("geo_places"."longitude" >= -180 AND "geo_places"."longitude" <= 180)
);
--> statement-breakpoint
CREATE TABLE "geo_resolution_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migration_run_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_path" text NOT NULL,
	"position" integer,
	"source_label" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "geo_resolution_status" NOT NULL,
	"reason" text NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chosen_place_id" uuid,
	"rule_provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"before_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geo_weather_cache" (
	"place_id" uuid NOT NULL,
	"month" integer NOT NULL,
	"generation_version" text NOT NULL,
	"input_fingerprint" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geo_weather_cache_place_id_month_generation_version_pk" PRIMARY KEY("place_id","month","generation_version"),
	CONSTRAINT "geo_weather_cache_month_check" CHECK ("geo_weather_cache"."month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "trip_geo_places" (
	"trip_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"place_id" uuid,
	"legacy_label" text,
	"status" "geo_resolution_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_geo_places_trip_id_position_pk" PRIMARY KEY("trip_id","position"),
	CONSTRAINT "trip_geo_places_position_check" CHECK ("trip_geo_places"."position" >= 0),
	CONSTRAINT "trip_geo_places_resolution_check" CHECK (
    ("trip_geo_places"."status" = 'resolved' AND "trip_geo_places"."place_id" IS NOT NULL)
    OR ("trip_geo_places"."status" <> 'resolved' AND "trip_geo_places"."place_id" IS NULL AND "trip_geo_places"."legacy_label" IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "source_code" text;--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD COLUMN "geo_place_id" uuid;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "geo_place_id" uuid;--> statement-breakpoint
ALTER TABLE "metro_systems" ADD COLUMN "geo_place_id" uuid;--> statement-breakpoint
ALTER TABLE "geo_place_names" ADD CONSTRAINT "geo_place_names_place_id_geo_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."geo_places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_place_names" ADD CONSTRAINT "geo_place_names_catalog_version_geo_catalog_versions_id_fk" FOREIGN KEY ("catalog_version") REFERENCES "public"."geo_catalog_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_places" ADD CONSTRAINT "geo_places_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_places" ADD CONSTRAINT "geo_places_catalog_version_geo_catalog_versions_id_fk" FOREIGN KEY ("catalog_version") REFERENCES "public"."geo_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_resolution_audit" ADD CONSTRAINT "geo_resolution_audit_chosen_place_id_geo_places_id_fk" FOREIGN KEY ("chosen_place_id") REFERENCES "public"."geo_places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_weather_cache" ADD CONSTRAINT "geo_weather_cache_place_id_geo_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."geo_places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_geo_places" ADD CONSTRAINT "trip_geo_places_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_geo_places" ADD CONSTRAINT "trip_geo_places_place_id_geo_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."geo_places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "geo_place_names_place_language_name_uq" ON "geo_place_names" USING btree ("place_id","language","normalized_name");--> statement-breakpoint
CREATE INDEX "geo_place_names_prefix_lookup_idx" ON "geo_place_names" USING btree ("prefix_key");--> statement-breakpoint
CREATE INDEX "geo_place_names_normalized_lookup_idx" ON "geo_place_names" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "geo_places_source_key_uq" ON "geo_places" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "geo_places_country_kind_name_idx" ON "geo_places" USING btree ("country_id","kind","primary_name");--> statement-breakpoint
CREATE INDEX "geo_resolution_audit_run_idx" ON "geo_resolution_audit" USING btree ("migration_run_id");--> statement-breakpoint
CREATE INDEX "geo_resolution_audit_entity_idx" ON "geo_resolution_audit" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "geo_resolution_audit_status_idx" ON "geo_resolution_audit" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trip_geo_places_place_idx" ON "trip_geo_places" USING btree ("place_id");--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "destination_reviews_geo_place_id_geo_places_id_fk" FOREIGN KEY ("geo_place_id") REFERENCES "public"."geo_places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_geo_place_id_geo_places_id_fk" FOREIGN KEY ("geo_place_id") REFERENCES "public"."geo_places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metro_systems" ADD CONSTRAINT "metro_systems_geo_place_id_geo_places_id_fk" FOREIGN KEY ("geo_place_id") REFERENCES "public"."geo_places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_source_code_unique" UNIQUE("source_code");