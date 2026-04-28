ALTER TABLE "highlights" ADD COLUMN "country_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "highlights_country_idx" ON "highlights" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "highlights_user_idx" ON "highlights" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "highlights" DROP COLUMN "country";