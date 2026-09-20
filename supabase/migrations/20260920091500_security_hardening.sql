-- ============================================================
-- Security hardening — findings from Supabase's database linter
-- ============================================================
--
-- Three classes of issue, none introduced by any single feature:
--
--  1. email_logs was exposed through PostgREST with RLS never enabled (ERROR).
--  2. Five SECURITY DEFINER functions were executable by the `anon` role
--     straight off /rest/v1/rpc/<name>, bypassing every check in our API
--     routes. increment_storage_used is the damaging one: anyone could inflate
--     an organizer's storage_used_bytes and lock them out of uploads.
--  3. All ten of our functions ran with a mutable search_path, so a role with
--     CREATE on any schema earlier in the path could shadow a table or
--     operator the function body resolves.
--
-- Verified before writing this: EVERY caller of these functions uses the
-- service_role key — Next.js routes and actions via createAdminClient()
-- (app/api/gallery/view, lib/plans/limits.ts, actions/events.ts,
-- actions/albums.ts, app/api/face/recall), the Modal jobs and worker/
-- face_worker.py via SUPABASE_SERVICE_ROLE_KEY. service_role bypasses both
-- RLS and these grants, so nothing in the product loses access.
--
-- ALTER FUNCTION ... SET search_path is used rather than CREATE OR REPLACE so
-- no function body is rewritten here. This migration changes permissions and
-- one table's RLS flag; it changes no logic.

-- ── 1. email_logs: enable RLS (service_role only, like takedown_requests) ──
-- Written by lib/email/resend.ts, read by actions/admin.ts — both admin client.
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_logs FROM anon, authenticated;

-- ── 2. Revoke public EXECUTE on every app RPC ──
-- PUBLIC is included because Supabase grants EXECUTE to PUBLIC by default on
-- function creation; revoking only anon/authenticated would leave that intact.
REVOKE EXECUTE ON FUNCTION increment_storage_used(uuid, bigint)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_view_count(text)                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_view_count_by(text, integer)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_album_view_count(uuid, integer)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION merge_event_theme(uuid, uuid, jsonb)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_album_covers(uuid[])                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION claim_face_processing_jobs(integer, integer)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION search_face_embeddings(vector, uuid, real, integer)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION search_face_embeddings_lite(vector, uuid, real, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION increment_storage_used(uuid, bigint)            TO service_role;
GRANT EXECUTE ON FUNCTION increment_view_count(text)                      TO service_role;
GRANT EXECUTE ON FUNCTION increment_view_count_by(text, integer)          TO service_role;
GRANT EXECUTE ON FUNCTION increment_album_view_count(uuid, integer)       TO service_role;
GRANT EXECUTE ON FUNCTION merge_event_theme(uuid, uuid, jsonb)            TO service_role;
GRANT EXECUTE ON FUNCTION get_album_covers(uuid[])                        TO service_role;
GRANT EXECUTE ON FUNCTION claim_face_processing_jobs(integer, integer)    TO service_role;
GRANT EXECUTE ON FUNCTION search_face_embeddings(vector, uuid, real, integer)      TO service_role;
GRANT EXECUTE ON FUNCTION search_face_embeddings_lite(vector, uuid, real, integer) TO service_role;

-- ── 3. Pin search_path on every function we own ──
-- pg_temp last, and explicitly, so a temp object cannot shadow a real one.
ALTER FUNCTION increment_storage_used(uuid, bigint)            SET search_path = public, pg_temp;
ALTER FUNCTION increment_view_count(text)                      SET search_path = public, pg_temp;
ALTER FUNCTION increment_view_count_by(text, integer)          SET search_path = public, pg_temp;
ALTER FUNCTION increment_album_view_count(uuid, integer)       SET search_path = public, pg_temp;
ALTER FUNCTION merge_event_theme(uuid, uuid, jsonb)            SET search_path = public, pg_temp;
ALTER FUNCTION get_album_covers(uuid[])                        SET search_path = public, pg_temp;
ALTER FUNCTION claim_face_processing_jobs(integer, integer)    SET search_path = public, pg_temp;
ALTER FUNCTION notify_new_media()                              SET search_path = public, pg_temp;
ALTER FUNCTION search_face_embeddings(vector, uuid, real, integer)      SET search_path = public, pg_temp;
ALTER FUNCTION search_face_embeddings_lite(vector, uuid, real, integer) SET search_path = public, pg_temp;

-- notify_new_media is a trigger function: it is invoked by the trigger
-- mechanism rather than through EXECUTE, so it needs the search_path pin but
-- no grant change.

-- Deliberately NOT addressed here:
--  * `vector` extension living in the public schema (linter INFO). Relocating
--    it rewrites the type and operator resolution behind every face_embeddings
--    column and index. Real cleanup, wrong blast radius for a permissions
--    migration.
--  * Leaked-password protection (HaveIBeenPwned) — a Supabase Auth setting,
--    not SQL. Toggle it in Dashboard → Authentication → Policies.
