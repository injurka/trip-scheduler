CREATE TYPE "public"."note_type" AS ENUM('folder', 'markdown', 'excalidraw');--> statement-breakpoint
ALTER TYPE "public"."trip_image_placement" ADD VALUE 'notes';--> statement-breakpoint
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
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_note_images" ADD CONSTRAINT "trip_note_images_note_id_trip_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."trip_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_note_images" ADD CONSTRAINT "trip_note_images_image_id_trip_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."trip_images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notes" ADD CONSTRAINT "trip_notes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_notes" ADD CONSTRAINT "trip_notes_parent_id_trip_notes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."trip_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_notes_parent_idx" ON "trip_notes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "trip_notes_trip_idx" ON "trip_notes" USING btree ("trip_id");