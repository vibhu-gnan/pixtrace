CREATE TYPE "public"."cover_type" AS ENUM('first', 'single', 'upload', 'slideshow');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_type" "cover_type" DEFAULT 'first' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_r2_key" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_slideshow_config" jsonb;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "preview_r2_key" text;