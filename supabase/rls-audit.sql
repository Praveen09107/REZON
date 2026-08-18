-- A REAL, runnable audit — not a checklist to eyeball. Run this against
-- the actual production Supabase project; it queries pg_catalog directly,
-- so its output is real evidence, not a description of intended state.

SELECT
  schemaname, tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('devices', 'telemetry', 'anomaly_events', 'model_registry',
                      'telemetry_summary', 'profiles', 'drift_status',
                      'notification_preferences');
-- Expected: rls_enabled = true for EVERY row. A false here means RLS was
-- designed (per Backend Spec §2) but never actually turned on — a real,
-- historically common Supabase mistake this query exists specifically to catch.

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
-- Manually cross-check this list against Backend Spec §2's real policies —
-- confirm nothing is missing, nothing extra/forgotten exists.
