DROP INDEX "geo_place_names_prefix_lookup_idx";--> statement-breakpoint
CREATE INDEX "geo_place_names_prefix_lookup_idx" ON "geo_place_names" USING btree ("prefix_key" text_pattern_ops);