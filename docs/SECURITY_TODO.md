# Security follow-ups

Open items from Supabase's database linter (`get_advisors`, type `security`).
The rest of that report was closed by
`supabase/migrations/20260920091500_security_hardening.sql`, which took the
project from **1 ERROR + 20 WARNs** to the three entries below.

Re-run the linter after any migration and diff against this list. Nothing here
should grow.

---

## 1. Leaked-password protection — BLOCKED (needs Pro plan)

**Status:** deferred, 2026-09-20. Requires a paid Supabase plan; the project is
on Free.

Supabase Auth can reject passwords that appear in the HaveIBeenPwned corpus.
It is off, so a user can currently sign up with a password already known to be
compromised — and credential stuffing against a public photo-gallery product is
a realistic attack, since organizers' accounts control other people's photos.

**To enable once on Pro:** Dashboard → **Authentication** → **Sign In /
Providers** → Email → *"Prevent use of leaked passwords"*. (Supabase has moved
this between releases; if it is not there, check Authentication → Settings.)
Note this is the **Authentication** section, not Database → Policies.

Docs: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**Interim mitigation:** none in place. If this stays deferred, consider a
client-side minimum-strength check at sign-up — weaker than the HIBP lookup,
but better than nothing.

---

## 2. `vector` extension in the `public` schema — WON'T FIX (for now)

**Status:** deliberate.

The linter wants extensions out of `public`. Moving `vector` rewrites type and
operator resolution behind every `face_embeddings` column and every HNSW/IVFFlat
index built on them. That is a real migration with a real risk of breaking face
search, and it belongs in its own change with its own verification — not folded
into a permissions cleanup.

Revisit only with a plan to rebuild the indexes and re-verify face search
end to end.

---

## 3. `rls_enabled_no_policy` (INFO × 8) — BY DESIGN

**Status:** intended, not a finding.

Eight tables have RLS enabled with no policies: `credit_click_counts`,
`email_logs`, `face_processing_jobs`, `invoices`, `r2_orphaned_keys`,
`takedown_requests`, `webhook_dead_letters`, `webhook_events`.

RLS-on-with-no-policies is how a table is made **service-role only**. Every one
of these is written and read exclusively through `createAdminClient()`, which
bypasses RLS. Adding policies would only widen access.

`credit_click_counts` in particular must stay this way: it holds per-event,
per-channel tap counts for the photographer credit. `anon` has a *table-level*
SELECT grant on `events`, which automatically covers columns added later — so
putting these counts on `events` (the "simpler" option) would let anyone read a
photographer's enquiry volume at
`/rest/v1/events?event_hash=eq.<hash>&select=credit_clicks`. The separate table
is the fix, not an accident.

---

## Verified closed

| Was | Now |
|---|---|
| `email_logs` exposed through PostgREST with RLS never enabled (**ERROR**) | RLS on, `REVOKE ALL` from anon/authenticated |
| 5 SECURITY DEFINER functions executable by `anon` — `increment_storage_used` let anyone inflate an organizer's storage and lock them out of uploads | `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`; `GRANT` to `service_role` only |
| 5 executable by `authenticated` | same |
| 10 functions with a mutable `search_path` | `SET search_path = public, pg_temp` on all 10 |

Confirmed by direct request against production with the anon key: reading
`credit_click_counts` and `email_logs`, and calling `increment_credit_click`,
`increment_storage_used` and `merge_event_theme`, are all denied. Service-role
access was confirmed intact at the same time (a live view-count increment).
