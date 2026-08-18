# SESSION 33 — Cloud Hardening
**Risk tier: HIGH-RISK (security-relevant, closes Phase 2 entirely).**
**Branch: `session/build-33-cloud-hardening`**
**Attach: `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §2-3 (as corrected, `DEC-060`), all prior Backend-touching sessions**

---

## Agent Instructions

The real, final security pass on everything Phase 1-2 built against the cloud. Three parts: implement the rate limit from `DEC-060`, audit that RLS is genuinely *enabled* (not just designed) on every table, and lock down the model storage bucket.

**What this session creates:**
- `supabase/functions/ingest/rate-limit.ts` — the real check
- `supabase/rls-audit.sql` — a real, runnable audit script, not a checklist to eyeball
- `supabase/storage-policy.sql`

---

## FILE 1: `supabase/functions/ingest/rate-limit.ts`

```typescript
// Deno/Supabase Edge Function — the real DEC-060 implementation.
import { createClient } from "@supabase/supabase-js";

export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>, deviceId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("devices")
    .select("last_seen_at")
    .eq("id", deviceId)
    .single();

  if (error || !data?.last_seen_at) return true;  // no prior request — allow

  const msSinceLast = Date.now() - new Date(data.last_seen_at).getTime();
  return msSinceLast >= 500;  // DEC-060's exact threshold
}

// Used in the real /ingest handler as:
//   if (!(await checkRateLimit(supabase, deviceId))) {
//     return new Response(JSON.stringify({ error: "rate limited" }),
//       { status: 429 });
//   }
```

## FILE 2: `supabase/rls-audit.sql`

```sql
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
```

## FILE 3: `supabase/storage-policy.sql`

```sql
-- Model storage bucket (Backend Spec §3.2's OTA source) — confirm it is
-- NOT publicly readable; access must be via signed URL only.
UPDATE storage.buckets SET public = false WHERE id = 'models';

CREATE POLICY "models_service_role_only" ON storage.objects
  FOR ALL USING (bucket_id = 'models' AND auth.role() = 'service_role');
-- Devices never authenticate as a real Supabase Auth user (they use the
-- custom device-secret scheme, Backend Spec §2) — model downloads happen
-- exclusively via the signed URL the /models/latest Edge Function issues,
-- never a direct authenticated bucket read.
```

---

## Verification Steps

**Step 1 — the rate limit, tested for real, not assumed:** send two real requests to the live `/ingest` endpoint less than 500ms apart — confirm the second genuinely returns 429. Send two requests 600ms apart — confirm both succeed. This is the literal proof `DEC-060`'s fix works, not just that the code was written.

**Step 2 — run `rls-audit.sql` against the real production project**, not a local copy — confirm every table shows `rls_enabled = true`. If any show `false`, this is a real, serious finding — fix immediately, do not proceed to Session 34 with RLS designed-but-inactive on any table.

**Step 3 — the storage bucket, tested as an actual attacker would:** attempt to fetch a model file directly via its bucket path (not a signed URL) from an unauthenticated client — confirm it genuinely fails. Confirm the real `/models/latest` signed-URL flow still works end to end.

**Step 4 — final Phase 2 close-out:** with `AUDIT_01`-equivalent rigor, confirm all 8 real gaps found across Phase 2 (`DEC-041, 046, 049, 055, 060` — 5 distinct root causes, some found more than once in different documents) are genuinely closed in the real system, not just logged as fixed in the specs.

## Phase 2 completion
This is the last Phase 2 session. If Steps 1-3 pass and Step 4's cross-check confirms every logged fix actually holds in the real deployed system, Phase 2 is genuinely, not just nominally, complete.

## Known open items
None remaining that are closable now — SD buffer reporting (Session 22) and per-sensor calibration status (Session 22) remain genuinely deferred, unrelated to this session's cloud-security scope.
