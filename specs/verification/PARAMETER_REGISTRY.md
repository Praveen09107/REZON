# Phase A.3 — Quantitative Parameter Registry
**Every qualitative statement in the ADD that must become an exact number, formula, or algorithm before Phase B can produce real pseudocode. Identification only — resolution happens in Phase B, with justification, referencing the relevant technical spec.**

| # | Parameter | ADD says | Status | Resolves in |
|---|---|---|---|---|
| 1 | Alert threshold (fused score) | "a lower threshold" | **RESOLVED (B.1)** — pre-calibration default 0.65 (logging-only during burn-in); post-burn-in via percentile calibration | AI/ML Spec |
| 2 | Response threshold (fused score) | "a higher threshold" | **RESOLVED (B.1)** — pre-calibration default 0.85; post-burn-in via percentile calibration | AI/ML Spec |
| 3 | Per-modality individual thresholds (for corroboration) | "each independently exceed their own thresholds" | **RESOLVED (B.1)** — pre-calibration default 0.75 per-modality "elevated" bar | AI/ML Spec |
| 4 | Corroboration count | "at least two modalities" | **DEFINED** — 2-of-5 | — (already resolved) |
| 5 | Debounce duration | "a few seconds," "several consecutive samples" | **RESOLVED (B.2)** — 4 consecutive fusion cycles (~4s) | Firmware Spec, safety-critical |
| 6 | Cooldown duration | "a minimum interval" | **RESOLVED (B.2)** — 60s minimum between actuations | Firmware Spec, safety-critical |
| 7 | Initial/cold-start fusion weights | Weights are "calibrated from burn-in data" | **RESOLVED (B.1)** — equal 0.2/modality cold-start (moot during burn-in logging-only mode) | AI/ML Spec |
| 8 | Audio spectrogram parameters (mel bins, window size, hop size, sample rate) | Not restated in the frozen ADD (only appeared in a pre-ADD draft, not carried forward) | **RESOLVED (B.1)** — 16kHz/1024-window/512-hop/40-mel | AI/ML Spec |
| 9 | IDNN context-window size (frames on each side of the masked center) | Not specified | **RESOLVED (B.1)** — ±3 frames (6 context) around masked center, 240-dim input | AI/ML Spec |
| 10 | Held-out evaluation AUC bar | Referenced only in prior research (MLPerf Tiny ≈0.85), never restated as a hard requirement in the ADD itself | **RESOLVED (B.1)** — 0.85 hard bar (MLPerf Tiny) | AI/ML Spec |
| 11 | Held-out split methodology (ratio, random vs. stratified vs. time-based) | Not specified | **RESOLVED (B.1)** — stratified per-dataset 20% holdout; burn-in holds out final 2 days | AI/ML Spec |
| 12 | Vibration spectral band boundaries (Hz ranges) | "2-3 frequency bands" | **RESOLVED (B.1)** — 0-10/10-50/50-100 Hz at 250Hz sampling | AI/ML Spec |
| 13 | ACS712 filter parameters (moving-average window, alpha) | "mandatory moving-average + alpha filter" | **RESOLVED (B.1)** — single-stage EMA, α=0.2 | AI/ML or Firmware Spec |
| 14 | MQ135 compensation formula (temp/humidity coefficients) | "temperature/humidity compensation" | **RESOLVED (B.1)** — linear form fixed, coefficients start at 0, burn-in-fit via regression | AI/ML Spec |
| 15 | Burn-in duration decision rule | "one to two weeks" | **RESOLVED (B.1)** — statistical stabilization rule (day-over-day <10% drift), 7-day min/14-day max | Training Pipeline section of AI/ML Spec |
| 16 | Idempotency sequence number: persistence, wraparound, reboot behavior | "monotonic per-device sequence number" | **RESOLVED (B.2)** — NVS-checkpointed counter, 100-unit reboot margin; wraparound not practically reachable | Backend Spec + Firmware Spec jointly |
| 17 | Retention policy window (raw resolution kept how long) | "a bounded window" | **RESOLVED (B.3)** — cloud: 30-day rolling retention (local tier is unbounded, per B.4) | Local MLOps Spec |
| 18 | Continuous aggregate field mapping | "hourly/daily rollups" | **RESOLVED (B.3 + B.4)** — cloud consumption shape fixed in B.3 (`telemetry_summary`), actual computation (real TimescaleDB `time_bucket`/continuous aggregate syntax) fixed in B.4 | Local MLOps Spec |
| 19 | NFR-4 real-time bound | "near-real-time... single-digit seconds" | **RESOLVED (B.2)** — ≤2s alert, ≤5s actuation, measured on-device | Integration Spec |
| 20 | Relay minimum physical on/off cycle time | Not addressed — this is a hardware datasheet fact, not a software decision | **RESOLVED (B.2)** — flagged 🔴 pending real relay datasheet; cooldown set with deliberate margin above any plausible value | Firmware Spec (sourced from the actual relay's datasheet) |
| 21 | Sensor polling rates (exact Hz per modality) | "fast," "slow," "moderate" | **RESOLVED (B.2)** — DHT22 2.5s, BMP280 5s, MQ135 1s | Firmware Spec |
| 22 | Database schema (tables, columns, types, constraints) | Conceptual entities only (§15.4) | **RESOLVED (B.3)** — full schema: devices, telemetry, anomaly_events, model_registry, telemetry_summary, profiles | Backend Spec |
| 23 | RLS policy exact predicate | "scoped to only its own rows" | **RESOLVED (B.3)** — write bypasses RLS via Edge Function + service role; read scoped by operator/viewer role | Backend Spec |

**Registry total: 26 entries. All 26 resolved as of `DEC-008` (Phase B completion), confirmed by direct re-verification on this date — not assumed from an earlier summary line.**

## Added by DEC-003 (local→cloud summary pipeline)

| # | Parameter | Status | Resolves in |
|---|---|---|---|
| 24 | Summary-push frequency (local→cloud) | **RESOLVED (B.3)** — hourly, rides along with local scheduled script cadence | Local MLOps Spec |
| 25 | Summary aggregate schema (which fields, which granularity) | **RESOLVED (B.3)** — telemetry_summary table, see §1 | Local MLOps Spec + Backend Spec |
| 26 | Reliability approach for this channel (retry? idempotent? simpler than device-channel since not safety-critical?) | **RESOLVED (B.3)** — natural-key UPSERT, not sequence-number machinery | Local MLOps Spec |

**Registry total: 26 entries, all resolved (see consolidated status at top of this document).**
