ALTER TABLE "city_weather_cache" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "city_weather_cache" CASCADE;--> statement-breakpoint
ALTER TABLE "trip_geo_places" DROP CONSTRAINT "trip_geo_places_resolution_check";--> statement-breakpoint
ALTER TABLE "highlights" ALTER COLUMN "geo_place_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_geo_places" ALTER COLUMN "place_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_geo_places" DROP COLUMN "legacy_label";--> statement-breakpoint
ALTER TABLE "trip_geo_places" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "trips" DROP COLUMN "cities";--> statement-breakpoint
ALTER TABLE "trips" DROP COLUMN "weather_data";--> statement-breakpoint
ALTER TABLE "destination_reviews" ADD CONSTRAINT "dest_reviews_city_geo_place_check" CHECK (("destination_reviews"."type" = 'country' AND "destination_reviews"."geo_place_id" IS NULL) OR ("destination_reviews"."type" = 'city' AND "destination_reviews"."geo_place_id" IS NOT NULL));