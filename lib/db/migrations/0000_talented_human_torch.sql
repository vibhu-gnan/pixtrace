CREATE TYPE "public"."media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"event_hash" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"event_date" timestamp,
	"cover_media_id" uuid,
	"theme" jsonb DEFAULT '{}'::jsonb,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "events_event_hash_unique" UNIQUE("event_hash")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"original_filename" varchar(512) NOT NULL,
	"media_type" "media_type" NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration" integer,
	"thumbnail_r2_key" text,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"captured_at" timestamp,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizers_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "organizers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "albums" ADD CONSTRAINT "albums_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "albums_event_id_idx" ON "albums" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "albums_sort_order_idx" ON "albums" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "events_event_hash_idx" ON "events" USING btree ("event_hash");--> statement-breakpoint
CREATE INDEX "events_organizer_id_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_album_id_idx" ON "media" USING btree ("album_id");--> statement-breakpoint
CREATE INDEX "media_event_id_idx" ON "media" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "media_r2_key_idx" ON "media" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "media_processing_status_idx" ON "media" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "media_captured_at_idx" ON "media" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "media_uploaded_at_idx" ON "media" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "organizers_auth_id_idx" ON "organizers" USING btree ("auth_id");--> statement-breakpoint
CREATE INDEX "organizers_email_idx" ON "organizers" USING btree ("email");