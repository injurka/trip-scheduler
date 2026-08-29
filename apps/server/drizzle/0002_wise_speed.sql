CREATE TYPE "public"."media_type" AS ENUM('image', 'video');--> statement-breakpoint
ALTER TABLE "trip_images" ADD COLUMN "media_type" "media_type" DEFAULT 'image' NOT NULL;