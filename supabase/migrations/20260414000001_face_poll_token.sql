-- Add poll_token to face_search_jobs for IDOR protection.
-- Each job gets a random 256-bit token at creation time; clients must
-- supply it when polling. Nullable so existing jobs (which expire in 2h)
-- remain valid rows — the poll endpoint returns 404 for token mismatches.
ALTER TABLE public.face_search_jobs ADD COLUMN poll_token text;
