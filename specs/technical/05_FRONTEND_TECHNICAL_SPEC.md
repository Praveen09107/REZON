# REZON — Frontend Technical Specification
**Phase B.5. Not safety-critical (outside ADD §9/§11/§12.2) — standard reality-overrides-plan rules apply. Every data reference below is checked against `03_BACKEND_CLOUD_TECHNICAL_SPEC.md`'s actual schema and `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md`'s actual state names, not assumed.**

**Confidence key (consistent with 01-04):** 🟢 standard practice/high confidence — 🟡 reasonable engineering default, validate in Phase 2 — 🔴 needs a decision only available once building starts.

---

## 1. Stack confirmation

Next.js (App Router) + shadcn/ui + Tailwind CSS, hosted on Vercel. 🟢 Unchanged from `FINAL_TECH_STACK.md` — restated here because this document is the implementation source of truth for Phase 2 sessions, which shouldn't need to cross-reference a different file for the basic stack choice.

## 2. Design tokens — the dark "command center" system (from the approved visual direction)

```css
--bg: #0a0d12;          --surface: #12161d;      --surface-2: #1a2029;
--border: #242b36;      --text: #e8edf4;         --text-2: #8b95a5;   --text-3: #5a6272;

--calm: #3fb0c9;        --calm-bg: #0f2a30;      /* normalized_score < 0.75 */
--elevated: #e0a030;    --elevated-bg: #2b2210;  /* 0.75 <= score < 0.85 */
--danger: #e0524a;      --danger-bg: #2d1414;    /* score >= 0.85 */
```
🟢 The three-tier color mapping is not arbitrary — it's a direct visual encoding of the AI/ML Spec's own §7.3 thresholds (0.75 "elevated," 0.85 "response"), so the color a user sees always corresponds to a real, documented number, not a separately-invented design threshold.

## 3. Routing & page structure (the 19-page sitemap, as routes)

```
/                          → Home (digital twin) — Monitor zone default
/streams                   → Sensor Streams
/incidents                 → Incidents (list) + /incidents/[id] (narrative detail)
/safety-chain              → Safety Chain Monitor
/timeline                  → Activity Timeline
/analytics                 → Analytics
/model                     → Model & Drift
/since-calibration         → Since-Calibration Comparison
/sandbox                   → Threshold Sandbox
/digest                    → Weekly Digest
/trust-audit               → Trust Audit
/device                    → Device & Machine
/calibration               → Sensor Calibration & Config
/deployments                → Deployments (OTA)
/notifications              → Notification Preferences
/access                    → User & Access Management
/settings                  → Settings
/help                      → Help / How REZON Works
/status                    → Public Status Page (no-auth route, separate layout — §5)
```
🟢 Flat structure, no deep nesting beyond incident detail — matches the sidebar's flat grouping (Monitor/Analyze/Manage/Utility) from the elevation vision doc.

## 4. Authentication flow

🟢 Supabase Auth (`03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §2) — standard email/password or magic-link sign-in, session managed via Supabase's client SDK, role (`operator`|`viewer`) read from the `profiles` table (Backend Spec §1) on session load and cached in a React context. Route guards: every route except `/status` requires an authenticated session; `/access` and any mutating action (labeling an incident, deploying OTA, editing notification preferences) additionally requires `role = 'operator'` — checked client-side for UX (immediate feedback) **and** server-side via the Backend Spec's existing RLS policies (§2) as the real enforcement, consistent with that document's explicit "RLS protects reads, not writes" clarification — the frontend never assumes client-side role checks are sufficient security, only UX polish.

## 5. Public Status Page — separate auth handling

🟢 `/status` renders with a distinct, minimal layout (no sidebar, no auth check) and queries only the `telemetry_summary` table (Backend Spec §1, the DEC-003 summary pipeline) via a public, RLS-scoped read — never `telemetry` or `anomaly_events` directly. This is the concrete implementation of Boundary #4's resolution (Phase A, DEC-003): the public app can only ever see summarized data, by construction, not by convention.

## 6. Real-time data strategy — different mechanisms for different urgency

🟡 Not one blanket strategy — two, chosen per page's actual liveness need:

| Pages | Mechanism | Why |
|---|---|---|
| Home, Sensor Streams, Safety Chain Monitor | Supabase Realtime subscription on `telemetry` and `anomaly_events` (push, not poll) | These need genuinely live, ambient updates — matches the Firmware Spec's ~1s fusion cycle (§1 of that document); polling would add latency the "ambient intelligence" design goal depends on not having |
| Incidents, Analytics, Model & Drift, Device & Machine | React Query, `refetchInterval` 15-30s | Real-time isn't the point here — a person reviewing history doesn't need sub-second updates, and constant polling on these pages would waste Supabase's free-tier request budget for no real benefit |
| Since-Calibration, Weekly Digest, Trust Audit, Settings, Access | React Query, fetch-on-navigation only (no polling) | Genuinely static within a session — recalculating on every visit is enough |

## 7. Per-view data contracts — checked against the real Backend schema

**Home (digital twin):** subscribes to `telemetry` (latest row per device), reads `audio_score, vibration_score, env_score, gas_score, current_score, fused_score` (all confirmed present in Backend Spec §1's schema — `env_score` specifically added during the Phase B quality audit, DEC-017) plus `env_temp/humidity/pressure` for the machine-health-adjacent context. `current_score` and the raw current reading additionally drive the "monitored machine" card.

**Safety Chain Monitor:** does **not** have a dedicated backend table — it's a real-time *rendering* of the Firmware Spec §5 state machine's current state, transmitted as part of the `anomaly_events` row when a candidate is active (`event_type` field, Backend Spec §1), or inferred as "MONITORING, no active candidate" when the latest telemetry row has no associated event. 🔴 **Open question for Phase 2 build**: does the device need to report intermediate CANDIDATE/debounce-counting state explicitly (a new field), or is showing only committed events (alert/actuation/suppressed) sufficient for the visualization? Leaning toward the latter for now (simpler, no new device-side reporting) — revisit if the visualization feels incomplete without live intermediate state.

**Incidents:** list view queries `anomaly_events` ordered by proximity to threshold (ADD §17.3's uncertainty-sort — computed client-side as `ABS(fused_score - 0.85)` ascending, or server-side via a view if this becomes a performance concern). Detail view reads `contributing_modalities` JSON (Backend Spec §1) for the explainability breakdown, including the optional `vibration_hw_confirmed` field (AI/ML Spec §7.5) when present.

**Trust Audit:** 🟡 not backed by live data at all — a static, versioned content page listing the actual safety mechanisms (corroboration, debounce, cooldown, override, OTA rollback) pulled from the ADD/technical specs at build time, not runtime. This is deliberate: it's documentation-as-product-feature, not a dashboard.

## 8. The narrative incident summary — exact generation logic (resolves the "AI-driven interaction" question honestly)

🟡 **Templated, not LLM-generated** — zero new backend/AI work, fully buildable from data already in `contributing_modalities`:
```
function generate_narrative(incident):
    top_modalities = sort(incident.contributing_modalities, by=score, desc)[:2]
    template = "{mod1} and {mod2}" if len(top_modalities) >= 2 else "{mod1}"
    sustained = incident.event_type == "actuation" ? "sustained for the debounce window" : ""
    return f"{template(top_modalities)} crossed threshold at {incident.recorded_at},
             {sustained}, {resulting_action(incident.event_type)}."
```
This is honest about what it is: string templating over real computed values, not generation — consistent with the elevation vision's own reasoning for why this fits an edge-anomaly-detection product better than a chatbot would.

## 9. Threshold Sandbox — replay logic

🟡 Client-side replay against already-fetched historical `telemetry` rows: re-run the AI/ML Spec §7.3 fusion formula and §7.4 corroboration check with user-adjusted threshold sliders, entirely in the browser — no new backend endpoint needed, since the raw per-modality scores are already stored and the fusion math is simple arithmetic. This keeps the "impressive but buildable" promise from the elevation vision literal: it's re-running existing, already-specified formulas on already-stored data.

## 10. Resilience states (ADD §17.5, made concrete)

```
for any live-data view:
  if last_successful_fetch > 60s ago:  render "last updated Ns ago" banner,
                                         keep showing last-known data (not blank)
  if last_successful_fetch > 5min ago: render explicit "connection lost" state,
                                         grey out (not hide) the stale visualization
  if initial load, no data yet:        skeleton loading state, never a blank page
```
🟢 Applies uniformly across every live-data page (§6's first two rows) — the specific rule the elevation vision named as the antidote to "the classic demo-day embarrassment" of a dashboard that looks live but isn't.

## 11. Component architecture (high-level, detailed in Phase 2 session specs)

Shared layout shell (sidebar + topbar + command palette, per the elevation vision §9) → per-zone route groups → page components consuming the React Query hooks / Realtime subscriptions defined in §6 → shared primitives (metric cards, badges, the confidence-strip component, the sensor-pulse component) used across Home, Streams, and Safety Chain Monitor consistently, not reimplemented per page.

---

## Cross-document consistency check performed while writing this document
Verified: `env_score` field referenced here exists in Backend Spec §1 (confirmed post-DEC-017 fix). Firmware Spec §5's state names (BOOT_SAFE/MONITORING/CANDIDATE/COOLDOWN) checked against §7's Safety Chain Monitor description — consistent. AI/ML Spec §7.3's exact threshold values (0.75/0.85) checked against this document's §2 color-mapping — consistent, not independently re-derived.
