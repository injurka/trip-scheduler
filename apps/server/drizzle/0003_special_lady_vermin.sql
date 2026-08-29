ALTER TABLE "users" ADD COLUMN "yandex_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_yandex_id_unique" UNIQUE("yandex_id");