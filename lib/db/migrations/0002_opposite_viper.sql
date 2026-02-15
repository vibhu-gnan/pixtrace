ALTER TABLE "events" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "cover_type";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "cover_r2_key";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "cover_slideshow_config";--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_slug_unique" UNIQUE("slug");--> statement-breakpoint
DROP TYPE "public"."cover_type";