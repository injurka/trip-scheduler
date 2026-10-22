CREATE TABLE "geo_catalog_countries" (
	"code" text PRIMARY KEY NOT NULL,
	"geonames_id" text NOT NULL,
	"source_name" text NOT NULL,
	"ascii_name" text NOT NULL,
	"name_ru" text,
	"legacy_country_id" text,
	"source_modified_at" date,
	"catalog_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geo_catalog_countries_geonames_id_unique" UNIQUE("geonames_id")
);
--> statement-breakpoint
ALTER TABLE "geo_places" DROP CONSTRAINT "geo_places_country_id_countries_id_fk";
--> statement-breakpoint
DROP INDEX "geo_places_country_kind_name_idx";--> statement-breakpoint
ALTER TABLE "geo_places" ADD COLUMN "country_code" text;--> statement-breakpoint
UPDATE "geo_places" AS place
SET "country_code" = country.code
FROM "geo_catalog_countries" AS country
WHERE country.legacy_country_id = place.country_id;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "geo_places" WHERE "country_code" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate geo_places.country_id: add explicit geo_catalog_countries.legacy_country_id mappings first';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "geo_places" ALTER COLUMN "country_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "geo_catalog_countries" ADD CONSTRAINT "geo_catalog_countries_legacy_country_id_countries_id_fk" FOREIGN KEY ("legacy_country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_catalog_countries" ADD CONSTRAINT "geo_catalog_countries_catalog_version_geo_catalog_versions_id_fk" FOREIGN KEY ("catalog_version") REFERENCES "public"."geo_catalog_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geo_places" ADD CONSTRAINT "geo_places_country_code_geo_catalog_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."geo_catalog_countries"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_places_country_kind_name_idx" ON "geo_places" USING btree ("country_code","kind","primary_name");--> statement-breakpoint
ALTER TABLE "geo_places" DROP COLUMN "country_id";
