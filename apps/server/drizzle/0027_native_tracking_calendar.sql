CREATE TABLE "native_tracking_keys" (
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "native_tracking_keys_user_id_device_id_pk" PRIMARY KEY("user_id","device_id"),
	CONSTRAINT "native_tracking_keys_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "native_tracking_keys" ADD CONSTRAINT "native_tracking_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;