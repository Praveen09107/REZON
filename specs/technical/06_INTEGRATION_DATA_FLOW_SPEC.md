# REZON — Integration & Data-Flow Specification
**Phase B.6 — the final technical spec. Traces ADD §19's four workflows through real function/endpoint names across specs 01-05. This document's explicit job is the cross-spec consistency check — it found two of the three real gaps discovered during Phase B (DEC-017, DEC-019), and traces every workflow below against the now-corrected foundation.**

---

## 1. Purpose

Every prior technical spec defines one subsystem correctly in isolation. This document verifies they're correct *together* — tracing each of the ADD's four workflows end-to-end through real names, not restating the ADD's narrative. Where tracing a workflow surfaced a real gap (not just a naming inconsistency), that gap was closed in the source document, not patched around here — `DEC-017` (AI/ML + Backend), `DEC-019`/`DEC-020` (Firmware) are the record of that.

## 2. Workflow A — Normal operation, traced

```
Device boot → BOOT_SAFE state (Firmware §5), relay forced safe
  → MONITORING state entered
  → Sensor Acquisition Task samples per Firmware §2 rates
  → Feature Extraction Task computes:
      audio: log-mel spectrogram (AI/ML §1)
      vibration: 3-band max-deviation z-score (AI/ML §3)
      environment: 3-parameter max-deviation z-score (AI/ML §6 — closed by DEC-017)
      gas: temp/humidity-compensated reading (AI/ML §4)
      current: EMA-filtered reading (AI/ML §5)
  → Inference & Fusion Task normalizes each (AI/ML §7.1) and computes
    fused_score (AI/ML §7.3) — operating_mode == FULL_OPERATION assumed
    here (BURN_IN's suppressed path is Workflow D, §5 below)
  → fused_score < alert_threshold (0.65) → no alert, MONITORING continues
  → Networking Task: HTTPS POST to /ingest (Backend §3.1), body includes
    seq_number (Firmware §7's NVS-checkpointed counter), all 5 scores
    (audio_score, vibration_score, env_score, gas_score, current_score —
    env_score confirmed present in Backend §1's schema per DEC-017),
    fused_score, and raw env_temp/humidity/pressure
  → Backend: UNIQUE(device_id, seq_number) + ON CONFLICT DO NOTHING
    (Backend §4) inserts into telemetry table (Backend §1)
  → Frontend Home page: Supabase Realtime subscription (Frontend §6)
    receives the new row, digital twin re-renders per Frontend §7's
    per-view data contract
```

## 3. Workflow B — Anomaly → actuation, traced

```
Fused score crosses alert_threshold (0.65)
  → LED/buzzer dispatched (Firmware Output Task, Firmware §1) — this
    path's exact GPIO-write logic is intentionally simple (a direct
    if fused_score > 0.65 write, no state machine needed, per
    Firmware §5's explicit note that the alert path doesn't require
    state transition) — not a gap, a deliberate proportionate-detail
    choice, distinct from actuation's genuine complexity
  → event submitted via /ingest with event:{type:"alert",
    contributing_modalities:{...}} (Backend §3.1)
  → Frontend Incidents page reflects it (Frontend §7), narrative
    generated client-side (Frontend §8)

If fused_score also crosses response_threshold (0.85) AND corroboration
(2-of-5, AI/ML §7.4) is satisfied:
  → MONITORING → CANDIDATE (Firmware §5) — only reachable because
    operating_mode == FULL_OPERATION (DEC-019/020's gate)
  → debounce counter increments each cycle; SW-420 corroboration check
    runs in parallel if vibration is one of the corroborating modalities
    (AI/ML §7.5, Firmware §2.1)
  → 4 consecutive cycles sustained AND cooldown elapsed → CANDIDATE →
    relay fires, state → COOLDOWN
  → event submitted via /ingest with event:{type:"actuation",
    contributing_modalities:{..., vibration_hw_confirmed: true|false}}
  → Frontend Safety Chain Monitor (Frontend §7) renders the gate
    sequence live; Incidents page shows the narrative reconstruction
```

## 4. Workflow C — Drift → retrain → redeploy, traced

```
Local scheduled script (Local MLOps §4) runs on operator's schedule:
  → pull_telemetry_from_cloud() — incremental pull from Backend's
    telemetry table
  → TimescaleDB continuous aggregates auto-compute (Local MLOps §1)
  → push_to_cloud_ingest_summary() → POST /ingest-summary (Backend §3.3)
    → UPSERT into telemetry_summary (Backend §6's natural-key reliability
      approach, not the device's sequence-number scheme — deliberately
      different mechanism for a genuinely different problem shape)
  → weekly: compute_psi() per modality (Local MLOps §3) — only audio's
    drift triggers retraining (the other 4 self-calibrate live, per
    AI/ML Spec §1's original design)
  → if PSI(audio) > 0.2: trigger_retrain()
      → train_idnn() with QAT (AI/ML §8's exact procedure)
      → evaluate_on_held_out() (AI/ML §9, 0.85 AUC bar)
      → mlflow_log_run(), promotion gate (Local MLOps §2): auto-promote
        only if AUC ≥ 0.85 AND ≥ current production model, else
        Blocker Report (not silently discarded)
      → upload_to_supabase_storage() (Backend §3.2's OTA source)
      → register in model_registry table, status='staged' (Backend §1)
  → Device's Networking Task, IDLE state (Firmware §6, OTA state
    machine — closed by DEC-019): periodic GET /models/latest
    (Backend §3.2) → DOWNLOADING → VERIFYING → DRY_RUN → SWAPPING
    (Firmware §6's exact state sequence)
  → device's active_model_version updates, reflected in next
    telemetry POST → Frontend Model & Drift page (Frontend §7)
```

## 5. Workflow D — Field-calibration burn-in, traced

```
First-ever deployment: operating_mode = BURN_IN (Firmware §5's gate,
  DEC-019/020) — set at device provisioning, before Session 9's
  integration/deploy step
  → MONITORING computes real fused_score and per-modality scores every
    cycle exactly as Workflow A, but:
      - alert path SUPPRESSED (no LED/buzzer/remote alert)
      - CANDIDATE structurally unreachable — actuation impossible
  → All scores still submitted via /ingest as normal telemetry —
    burn-in data accumulates in the same telemetry table, distinguished
    only by timestamp falling within the burn-in window, not a special
    schema flag
  → AI/ML Spec §10's stopping rule checked (🟡 by the local scheduled
    script, reading accumulated telemetry — not by the device itself,
    which has no reason to evaluate its own graduation criteria)
  → When criteria met: the SAME retraining pipeline as Workflow C runs
    once (AI/ML §8's QAT procedure, §9's held-out eval, now against
    burn-in data specifically) — this is explicitly the same mechanism,
    not a separate one, per ADD §10.4 and Local MLOps §4's design
  → New calibrated model + calibrated fusion weights/thresholds
    (AI/ML §7.2's post-burn-in weight formula) published via the
    same OTA path as Workflow C
  → Device receives the update, and as part of processing it:
    operating_mode transitions BURN_IN → FULL_OPERATION (🔴 open
    implementation detail for Phase 1: whether this transition is
    triggered by the OTA payload itself carrying a mode-change flag,
    or a separate explicit signal — flagged here rather than assumed,
    since it wasn't resolved by any prior document)
  → Frontend's onboarding/calibration-progress view (elevation vision,
    Pillar 6) reflects this transition as the "graduated to full
    operation" moment
```

## 6. Cross-spec consistency check — performed while writing this document

Confirmed consistent: AI/ML §7.3-7.5 ↔ Firmware §2.1/§5 modality/state references (post-DEC-017/019 renumbering). Backend §1 schema ↔ AI/ML §6/§7 score fields (env_score present, post-DEC-017). Backend §3.2 OTA contract ↔ Firmware §6 OTA state machine (checksum field names match: `checksum_sha256` in both). Local MLOps §4's `push_to_cloud_ingest_summary()` ↔ Backend §3.3's `/ingest-summary` endpoint (same operation, consistent naming). Frontend §7's data contracts ↔ Backend §1 schema (verified field-by-field while writing Frontend Spec §7, per DEC-018's process note).

**One open item genuinely surfaced by this trace, not resolved by any prior document** — flagged in Workflow D above (§5): the exact mechanism for the BURN_IN→FULL_OPERATION transition trigger. Left open rather than invented, per this project's own standing rule against silently filling gaps.

## 7. Master function/endpoint glossary

| Name | Defined in | Called from |
|---|---|---|
| `POST /ingest` | Backend §3.1 | Device Networking Task (Firmware §1) |
| `GET /models/latest` | Backend §3.2 | Device OTA state machine, IDLE (Firmware §6) |
| `POST /ingest-summary` | Backend §3.3 | Local scheduled script (Local MLOps §4) |
| `pull_telemetry_from_cloud()` | Local MLOps §4 | Local scheduled script |
| `push_to_cloud_ingest_summary()` | Local MLOps §4 | Local scheduled script |
| `compute_psi()` | Local MLOps §3 | Local scheduled script, weekly |
| `trigger_retrain()` | Local MLOps §4 | Local scheduled script, on drift or burn-in completion |
| `train_idnn()` | AI/ML §8 (invoked by Local MLOps §4) | `trigger_retrain()` |
| `evaluate_on_held_out()` | AI/ML §9 (invoked by Local MLOps §4) | `trigger_retrain()` |
| Actuation state machine | Firmware §5 | Inference & Fusion Task, every cycle |
| OTA state machine | Firmware §6 | Networking Task, periodic |
| `check_sw420_corroboration()` | Firmware §2.1 | Inference & Fusion Task, when vibration corroborates |
| `generate_narrative()` | Frontend §8 | Incidents detail view, client-side |

---

## Phase B completion

All six technical specs now exist and are cross-checked against each other, not just internally complete. Three real gaps were found and closed during this phase (`DEC-017`, `DEC-019`, `DEC-020`) — none were cosmetic; all three would have left Claude Code inventing behavior mid-session if undetected. Phase B is genuinely done.
