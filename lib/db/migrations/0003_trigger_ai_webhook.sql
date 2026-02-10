-- Create database trigger to notify when new media is inserted
-- This will be used to trigger the Supabase Edge Function for AI processing

-- Create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION notify_new_media()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform an HTTP request to the Supabase Edge Function
  -- Note: This requires pg_net extension or http extension
  -- For now, we'll use Supabase's built-in webhook functionality
  -- which can be configured in the Supabase dashboard

  -- Alternatively, you can use NOTIFY/LISTEN pattern
  PERFORM pg_notify(
    'new_media',
    json_build_object(
      'media_id', NEW.id,
      'event_id', NEW.event_id,
      'r2_key', NEW.r2_key,
      'media_type', NEW.media_type
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_new_media ON media;
CREATE TRIGGER trigger_new_media
  AFTER INSERT ON media
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_media();
