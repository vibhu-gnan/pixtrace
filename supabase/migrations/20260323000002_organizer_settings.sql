-- Add settings-related columns to organizers table
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_new_gallery_view": true,
  "email_photo_upload_activity": true,
  "email_storage_warnings": true,
  "email_billing_alerts": true,
  "email_product_updates": false,
  "email_tips_and_tutorials": false
}'::jsonb NOT NULL;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS default_event_preferences JSONB DEFAULT '{
  "watermark_enabled": true,
  "downloads_enabled": false,
  "auto_approve_photos": true
}'::jsonb NOT NULL;
