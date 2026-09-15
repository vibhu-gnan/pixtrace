-- Recovered from production. This migration was applied directly (via the Supabase
-- dashboard) and never had a file, so a replay from this directory alone would have
-- left `get_album_covers` missing. Dumped with pg_get_functiondef and committed so the
-- migration history and the files agree.

CREATE OR REPLACE FUNCTION public.get_album_covers(album_ids uuid[])
 RETURNS TABLE(album_id uuid, preview_r2_key text, r2_key text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT DISTINCT ON (m.album_id) m.album_id, m.preview_r2_key, m.r2_key
  FROM media m
  WHERE m.album_id = ANY(album_ids)
    AND m.media_type = 'image'
  ORDER BY m.album_id, m.created_at ASC;
$function$;
