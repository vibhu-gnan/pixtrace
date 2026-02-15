ALTER TABLE "events" DROP CONSTRAINT "events_slug_unique";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_download" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_slideshow" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "slug";