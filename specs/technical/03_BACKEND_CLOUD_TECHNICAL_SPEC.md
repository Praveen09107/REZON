# REZON — Backend / Cloud Technical Specification
**Phase B.3. Resolves Parameter Registry entries #17, #18, #22, #23, #24, #25, #26 and closes Boundary #1 (server side) and Boundary #6 (the DEC-003 summary pipeline). Not safety-critical (outside ADD §9/§11/§12.2) — standard reality-overrides-plan rules apply if implementation finds a reason to deviate.**

**Confidence key (adopted from B.1/B.2):** 🟢 standard practice/high confidence — 🟡 reasonable engineering default, validate in Phase 1 — 🔴 needs real data in hand.

---

## 1. Database schema (resolves Registry #22)

Plain PostgreSQL tables (no TimescaleDB extension — per ADD §13.2, deep time-series features live only in the local tier). 🟢

```sql
-- Device registry
devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_secret_hash  text NOT NULL,           -- bcrypt/argon2 hash, never the raw secret
  firmware_version    text,
  active_model_version text,
  status              text NOT NULL DEFAULT 'provisioned',  -- provisioned | burn_in | active | offline
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz,
  -- Device health fields (NEW — found missing during Session 22 prep;
  -- Frontend Spec §7 explicitly promises the Device & Machine page
  -- shows heap/PSRAM/signal/SD-buffer, but no column ever existed for
  -- any of them. Same failure mode as DEC-041's drift_status gap:
  -- a page was scoped before its data source was verified to exist.)
  free_heap_bytes     integer,
  psram_used_bytes    integer,
  psram_total_bytes   integer,
  wifi_rssi_dbm       integer,
  sd_buffer_minutes   integer                  -- approx minutes of
                                                  -- buffered data on
                                                  -- the SD card
)

-- Recent raw-derived telemetry (thin, recent-window per ADD §13.2)
telemetry (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         uuid NOT NULL REFERENCES devices(id),
  seq_number        bigint NOT NULL,           -- device-side idempotency key, from B.2 §6
  recorded_at       timestamptz NOT NULL,      -- device's own clock at capture
  received_at       timestamptz NOT NULL DEFAULT now(),
  audio_score       real, vibration_score real, env_score real, gas_score real, current_score real,
  env_temp real, env_humidity real, env_pressure real,
  fused_score       real NOT NULL,
  UNIQUE (device_id, seq_number)               -- THE idempotency enforcement (§4)
)

-- Alerts, actuations, and suppressed candidates (full audit trail per ADD §11)
anomaly_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id              uuid NOT NULL REFERENCES devices(id),
  seq_number             bigint NOT NULL,
  event_type             text NOT NULL,        -- alert | actuation | suppressed_debounce | suppressed_cooldown
  recorded_at            timestamptz NOT NULL,
  fused_score            real NOT NULL,
  contributing_modalities jsonb NOT NULL,       -- {"gas": 0.88, "current": 0.79, ...} — explainability data (ADD §9.7)
  human_label            text,                  -- null | confirmed | false_alarm — operator review feedback
  labeled_at             timestamptz,
  UNIQUE (device_id, seq_number)
)

-- Model lineage (mirrors local MLflow registry; this is the OTA-relevant subset)
model_registry (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version             text NOT NULL UNIQUE,
  held_out_auc        real NOT NULL,
  checksum_sha256      text NOT NULL,
  storage_path        text NOT NULL,           -- Supabase Storage object path
  status              text NOT NULL DEFAULT 'staged',  -- staged | active | archived | rolled_back
  training_data_note  text,                    -- human-readable snapshot reference, not the full dataset
  created_at          timestamptz NOT NULL DEFAULT now()
)

-- Local→cloud summary pipeline (NEW, from DEC-003 — feeds the public Analytics zone)
telemetry_summary (
  device_id           uuid NOT NULL REFERENCES devices(id),
  period_start         timestamptz NOT NULL,
  granularity          text NOT NULL,          -- 'hour' | 'day'
  avg_fused_score      real NOT NULL,
  max_fused_score      real NOT NULL,
  modality_attribution jsonb NOT NULL,         -- {"audio": 0.42, "vibration": 0.24, ...} — % contribution
  event_count          int NOT NULL DEFAULT 0, -- alerts + actuations in this period
  PRIMARY KEY (device_id, period_start, granularity)   -- natural key, doubles as idempotency (§6)
)

-- Drift status (NEW — found missing during Phase 2 frontend work; the
-- Model & Drift page had no data source without this. Local MLOps
-- Spec §3's log_drift_report() computes this locally but never had
-- anywhere to push it — closed here, same pattern as telemetry_summary.)
drift_status (
  device_id    uuid NOT NULL REFERENCES devices(id),
  modality     text NOT NULL,          -- 'audio' | 'vibration' | 'environment' | 'gas' | 'current'
  psi_value    real NOT NULL,
  status       text NOT NULL,          -- 'stable' | 'watch' | 'significant' (Local MLOps Spec §3's 0.1/0.2 cutoffs)
  checked_at   timestamptz NOT NULL,
  PRIMARY KEY (device_id, modality)    -- latest status only, natural-key UPSERT like telemetry_summary
)

-- Roles (Supabase Auth's auth.users holds identity; this maps identity to REZON's two roles)
profiles (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id),
  role     text NOT NULL DEFAULT 'viewer'      -- operator | viewer, per ADD §16.1
)

-- Notification preferences (NEW — found missing while building Session
-- 24; storage only. IMPORTANT SCOPE NOTE, not resolved by this table:
-- no email/push SENDING infrastructure exists anywhere in this
-- architecture — Supabase does not send emails/push on its own, and
-- no third-party service (Resend, SendGrid, web push) was ever
-- specced. This table lets preferences be stored and edited; it does
-- not, by itself, cause anything to be delivered. The only real,
-- working notification channel today is the in-app toast (Session 12,
-- Frontend Spec), which only reaches you while the app is open.)
notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id),
  alert_threshold    real NOT NULL DEFAULT 0.65,   -- mirrors AI/ML Spec
                                                     -- §7.3's real alert bar
                                                     -- as the sensible default
  quiet_hours_start  smallint,                      -- 0-23, nullable = no quiet hours
  quiet_hours_end    smallint
)
```

---

## 2. Row-Level Security (resolves Registry #23) — and a precision the ADD only gestured at

**The device's write path does not go through RLS at all.** The Edge Function validates the device secret itself (application-level, against `devices.device_secret_hash`) and writes using Supabase's service-role key, which bypasses RLS by design. This is the standard, correct pattern for a trusted server-side intermediary — RLS's real job here is protecting the **frontend's read access**, not the device's write access. Stating this precisely resolves an ambiguity the ADD's "Row-Level Security scopes each device to its own data" (§12.4) left implicit.

```sql
-- Read policies (frontend, via Supabase Auth user JWT)
CREATE POLICY telemetry_read ON telemetry FOR SELECT
  USING (true);   -- 🟡 single-device scope today: any authenticated user (operator or viewer)
                  -- can read. Structured to extend cleanly to per-device scoping if this
                  -- ever becomes multi-device: replace `true` with
                  -- `device_id IN (SELECT device_id FROM operator_device_grants WHERE user_id = auth.uid())`

CREATE POLICY anomaly_events_write_label ON anomaly_events FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));
  -- Only operators can attach human_label — viewers are read-only, per ADD §16.1
```
🟢 The write-bypasses-RLS / read-uses-RLS split is standard Supabase practice, not a REZON-specific invention.

---

## 3. Edge Function contracts (closes Boundary #1, server side)

### 3.1 `POST /ingest` — device telemetry (matches B.2 §6's device-side idempotency scheme exactly)

```
Request headers: Authorization: Bearer <device_secret>
Request body (JSON):
{
  "seq_number": 48213,
  "recorded_at": "2026-08-07T14:22:03Z",
  "audio_score": 0.12, "vibration_score": 0.09, "env_score": 0.15, "gas_score": 0.18,
  "current_score": 0.07, "env_temp": 24.3, "env_humidity": 58.1,
  "env_pressure": 1012.4, "fused_score": 0.14,
  "event": null   // OR {"type": "alert"|"actuation"|"suppressed_...", "contributing_modalities": {...}}
}

Server logic:
  1. Validate device_secret against devices.device_secret_hash. Invalid → 401.
  2. RATE CHECK (added during Session 33 hardening — a real gap: idempotency
     protects against duplicate data, not against a compromised device or
     leaked secret flooding genuinely NEW sequence numbers rapidly): reject
     with 429 if this device's last accepted request was < 500ms ago — well
     under the ~1s real fusion cadence (Firmware Spec §1), so no legitimate
     traffic is ever rejected, but a flood is. Checked against
     devices.last_seen_at, already tracked — no new infrastructure (no
     Redis, consistent with this project's standing rejection of it
     elsewhere) needed for this single-device-scale system.
  3. INSERT INTO telemetry (...) ON CONFLICT (device_id, seq_number) DO NOTHING.
  4. If event is present: INSERT INTO anomaly_events (...) ON CONFLICT (device_id, seq_number) DO NOTHING.
  5. UPDATE devices SET last_seen_at = now(), free_heap_bytes = $body.free_heap_bytes,
     psram_used_bytes = $body.psram_used_bytes, psram_total_bytes = $body.psram_total_bytes,
     wifi_rssi_dbm = $body.wifi_rssi_dbm, sd_buffer_minutes = $body.sd_buffer_minutes
     WHERE id = device_id.
     (Fields added post-Session-22-discovery — device health metadata
     rides along on the same /ingest call already happening every
     fusion cycle, rather than a separate endpoint/call for something
     this infrequent-to-change and cheap to include.)
  6. Return 200 regardless of whether step 3/4 inserted or was a no-op duplicate —
     the device never needs to distinguish "accepted new" from "accepted duplicate,"
     both are success from its perspective. 🟢 This is what makes retries genuinely
     simple on the device side: always safe to retry, never need special-case logic.
```

### 3.2 `GET /models/latest` — OTA check

```
Response: { "version": "idnn-v5", "checksum_sha256": "...", "download_url": "<signed Supabase Storage URL, 1h expiry>" }
  🟡 returned only if model_registry.status = 'staged' for a version newer than the
  device's currently reported active_model_version — otherwise 204 No Content.
```

### 3.3 `POST /ingest-summary` — local tier's summary push (closes Boundary #6)

```
Request headers: Authorization: Bearer <local-tier service credential>
  🟡 A SEPARATE credential from the device secret — this call originates from the
  operator's local machine, not the physical device, and should not share the
  device's identity/trust boundary.

Request body: one or more telemetry_summary rows (batched, since the local tier
  may be catching up after being offline).

Server logic: INSERT ... ON CONFLICT (device_id, period_start, granularity) DO UPDATE
  SET avg_fused_score = EXCLUDED.avg_fused_score, ... — an UPSERT, not an
  idempotency-key scheme. See §6 for why this is sufficient here without
  reusing B.2's sequence-number machinery.
```

---

## 4. Idempotency — server side (completes Boundary #1)

The `UNIQUE (device_id, seq_number)` constraint on `telemetry` and `anomaly_events`, combined with `ON CONFLICT DO NOTHING`, is the entire server-side mechanism. 🟢 No application-level dedup logic is needed beyond this constraint — the database itself enforces it, which is simpler and more reliable than hand-rolled dedup code.

---

## 5. Retention & continuous aggregates — cloud side clarification (relates to #17/#18, resolved fully in Local MLOps Spec, B.4)

The cloud `telemetry` table is genuinely thin by design (ADD §13.2) — 🟡 propose a **30-day rolling retention** on raw cloud telemetry (a simple scheduled `DELETE WHERE recorded_at < now() - interval '30 days'`, run via a Supabase scheduled Edge Function or `pg_cron` if available on the plan), since deep history was never the cloud tier's job — that's `telemetry_summary` (permanent, tiny, aggregated) and the local TimescaleDB (full-fidelity, unbounded, per B.4). This keeps cloud storage comfortably within Supabase's free tier regardless of how long the device runs.

---

## 6. Summary pipeline — frequency and reliability (resolves Registry #24, #25, #26)

**Frequency (#24):** 🟡 **hourly** — matches the `granularity = 'hour'` continuous aggregate the local tier computes (B.4 defines the aggregate computation itself; this spec defines what arrives at the cloud). Once a full hour's aggregate is finalized locally, it's pushed within the same run of the local scheduled script (ADD §14.2) — no separate timer needed, it rides along with the script's own cadence.

**Schema (#25):** the `telemetry_summary` table in §1 above.

**Reliability approach (#26) — deliberately simpler than the device's scheme, and here's why that's the right call, not a shortcut:** the device's idempotency mechanism (B.2 §6) exists because a single physical event needs a unique identity across unreliable retries. The summary pipeline doesn't have that problem — each row's natural key is *already* unique and stable (`device_id` + `period_start` + `granularity` — "this device's data for hour N" is the same request no matter how many times it's retried). So instead of reusing the sequence-number machinery, an **UPSERT** (`ON CONFLICT ... DO UPDATE`) is the correct, simpler mechanism: retrying the same hour's push just overwrites with the same (or a corrected, more complete) value, which is exactly the desired behavior — not a workaround, a better-fitted tool for a genuinely different problem shape.

---

## Registry entries resolved by this document

#17 (cloud retention: 30-day rolling), #18 (continuous aggregate mapping — the cloud-side consumer shape; full computation defined in B.4), #22 (full schema), #23 (RLS: write bypasses via service role + Edge Function validation, read scoped by role), #24 (summary push: hourly), #25 (summary schema), #26 (summary reliability: UPSERT on natural key, not sequence-number machinery).

**25 of 26 resolved (12 B.1 + 6 B.2 + 7 B.3). Remaining: none directly — B.4 (Local MLOps Spec) completes the continuous-aggregate *computation* (the cloud-side consumption shape is already fixed here) and the scheduled-script pseudocode, closing the loop rather than resolving a new numbered registry gap.**
