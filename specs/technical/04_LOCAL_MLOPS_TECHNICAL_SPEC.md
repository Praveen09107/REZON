# REZON — Local MLOps Technical Specification
**Phase B.4 — the final Phase B document. Completes Registry #18 (continuous-aggregate computation) and specifies the scheduled script, local TimescaleDB schema, MLflow usage, and Evidently drift tests in full. Not safety-critical on its own, but its output (retrained models) feeds directly into the safety-critical AI/ML spec's promotion gate — flagged where relevant.**

**Confidence key (adopted throughout Phase B):** 🟢 standard practice/high confidence — 🟡 reasonable engineering default, validate in Phase 1 — 🔴 needs real data in hand.

---

## 1. Local TimescaleDB schema — full-featured, unrestricted (completes Registry #18)

Mirrors the cloud schema's shape but as genuine hypertables, with the time-series features the cloud tier was deliberately never given (ADD §14.2, §15.1).

```sql
-- Hypertable: full-resolution telemetry, partitioned by time
SELECT create_hypertable('telemetry', 'recorded_at');
-- (same columns as the cloud schema, B.3 §1 — this is the unbounded, full-fidelity copy)

-- Retention: raw resolution kept 90 days locally (generous vs. cloud's 30-day —
-- local isn't free-tier-constrained, but unbounded raw storage still isn't smart
-- practice; 🟡 90 days is a reasonable default, adjustable if disk pressure
-- becomes real)
SELECT add_retention_policy('telemetry', INTERVAL '90 days');

-- Continuous aggregates (TimescaleDB native — auto-maintained, not a manual job)
CREATE MATERIALIZED VIEW telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT
  device_id,
  time_bucket('1 hour', recorded_at) AS period_start,
  avg(fused_score) AS avg_fused_score,
  max(fused_score) AS max_fused_score,
  avg(audio_score) AS avg_audio_score,
  avg(vibration_score) AS avg_vibration_score,
  avg(env_score) AS avg_env_score,          -- ADDED: missing since this
                                              -- document predates DEC-017's
                                              -- fix to the AI/ML spec's
                                              -- environment-scoring gap;
                                              -- caught while writing Session
                                              -- 29, same failure shape as
                                              -- DEC-041/046/049
  avg(gas_score) AS avg_gas_score,
  avg(current_score) AS avg_current_score,
  count(*) FILTER (WHERE fused_score > 0) AS sample_count
FROM telemetry
GROUP BY device_id, period_start;

CREATE MATERIALIZED VIEW telemetry_daily
WITH (timescaledb.continuous) AS
SELECT device_id, time_bucket('1 day', recorded_at) AS period_start,
       avg(fused_score) AS avg_fused_score, max(fused_score) AS max_fused_score
FROM telemetry GROUP BY device_id, period_start;

-- Refresh policy: keep aggregates current without manual triggering
SELECT add_continuous_aggregate_policy('telemetry_hourly',
  start_offset => INTERVAL '3 hours', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

🟢 This is standard TimescaleDB usage — the point of choosing it (ADD §14.2's stated reason) was exactly to get this native continuous-aggregate machinery instead of hand-rolling rollup jobs. **This is the piece Registry #18 was waiting on** — B.3 already fixed what the cloud *consumes* (`telemetry_summary`'s shape); this is how those numbers actually get computed before being pushed.

---

## 2. MLflow — exact usage pattern

**Per training/retraining run, logged as one MLflow run:**

| Logged as | Content |
|---|---|
| Parameters | dataset snapshot reference (not the full dataset — a pointer/hash), QAT settings from B.1 §7, IDNN architecture hyperparameters (context window size, layer widths) |
| Metrics | held-out AUC (B.1 §8), per-modality drift scores that triggered this run (if retraining, not initial training) |
| Artifacts | both the float32 and INT8-quantized model files |

**Registry stage transitions (MLflow's built-in `None → Staging → Production → Archived` model):**
```
New run completes → registered as a new model version, stage = Staging (always,
  regardless of AUC — nothing skips straight to Production)

Promotion check (automatic):
  IF held_out_auc >= 0.85 (B.1 §8's hard bar)
     AND held_out_auc >= current_Production_model.held_out_auc  (ADD §14.3's
         "not worse than incumbent" gate, now a precise comparison)
  THEN: transition to Production, demote previous Production model to Archived
  ELSE: stays in Staging, raise a Blocker Report — "a retrained model failed
        the promotion gate," with the actual AUC numbers on both sides. This is
        NOT silently discarded; per METHODOLOGY.md's verification philosophy, a
        failed gate is a finding to report, not a result to quietly drop.
```
🟢 Using MLflow's native staging concept rather than a custom status field keeps this aligned with how the tool is actually meant to be used — no REZON-specific reinvention needed here.

---

## 3. Evidently — exact drift tests and thresholds (genuinely new; nothing in the ADD specified this precisely)

**Metric: Population Stability Index (PSI)**, computed per modality, comparing a recent window's score distribution against the training/burn-in baseline distribution. 🟢 PSI is chosen specifically because it's standard, interpretable practice for exactly this comparison (used broadly in both ML monitoring and its origin domain, credit-risk modeling, for the same "has this distribution shifted" question) — not a REZON-specific invention.

| Parameter | Value | Confidence |
|---|---|---|
| Comparison window | last 7 days vs. burn-in baseline | 🟡 |
| PSI drift threshold | 0.2 | 🟢 industry-standard cutoff: <0.1 = no significant shift, 0.1-0.2 = moderate, >0.2 = significant — 0.2 is the conventional "act on this" line |
| Check frequency | weekly | 🟡 balances catching genuine drift promptly against not retraining on noise |
| Scope | computed independently per modality (audio, vibration, gas, current, environment) | 🟢 — a drift in one modality shouldn't be masked by four stable ones, mirroring the fusion design's own "don't average away a real signal" principle from B.1 §6 |

**If any single modality's PSI exceeds 0.2:** the scheduled script's drift branch triggers (§4 below) — but note only the **audio model** actually gets retrained as a result (per ADD's own design, the other four modalities are self-calibrating statistical monitors that continuously re-baseline themselves live, per B.1 §1 — a drift alert on, say, the gas modality is diagnostic information for the operator, not a retraining trigger, since that modality already adapts on its own).

---

## 4. The scheduled script — real pseudocode (completes ADD §14.2's "single scheduled script")

```
function scheduled_maintenance_run():
    # Safe to run multiple times a day with no harm — every step is either
    # idempotent (pull/push) or gated (retrain only fires on real drift +
    # real validation pass). Designed to run whenever the operator's machine
    # is on, not dependent on a strict cron cadence.

    # 1. Incremental pull (ADD §15.2's durability model — frequent, small)
    new_rows = pull_telemetry_from_cloud(since=last_pull_checkpoint)
    insert_into_local_timescaledb(new_rows)
    update_pull_checkpoint()

    # 2. Continuous aggregates are auto-maintained by TimescaleDB (§1) —
    #    nothing to do here explicitly, they're already current.

    # 3. Summary push (DEC-003 / B.3 §6 — rides along with this same run)
    latest_hourly = query_telemetry_hourly(not_yet_pushed=True)
    push_to_cloud_ingest_summary(latest_hourly)   # UPSERT, safe to retry (B.3 §6)
    mark_as_pushed(latest_hourly)

    # 4. Drift check (weekly cadence, §3)
    if days_since(last_drift_check) >= 7:
        for modality in [audio, vibration, gas, current, environment]:
            psi = compute_psi(recent_window(modality), burnin_baseline(modality))
            log_drift_report(modality, psi)
            push_drift_status_to_cloud(modality, psi)   # NEW — closes the
                                                          # gap found during
                                                          # Phase 2 frontend
                                                          # work: without this,
                                                          # the Model & Drift
                                                          # page has no data
                                                          # source. UPSERT into
                                                          # drift_status
                                                          # (Backend Spec §1),
                                                          # same natural-key
                                                          # pattern as the
                                                          # summary pipeline.
        last_drift_check = now()

        if psi[audio] > 0.2:                       # only audio triggers retraining
            trigger_retrain()

function trigger_retrain():
    recent_normal_data = query_local_timescaledb(recent_window, label='normal')
    new_model = train_idnn(recent_normal_data, qat=True)   # B.1 §7's exact QAT procedure
    auc = evaluate_on_held_out(new_model, held_out_set)     # B.1 §8's protocol
    mlflow_log_run(new_model, auc, dataset_snapshot_ref)    # §2 above

    if auc >= 0.85 and auc >= production_model.auc:
        mlflow_promote_to_production(new_model)
        upload_to_supabase_storage(new_model)               # B.3 §3.2's OTA source
        register_in_model_registry_table(new_model, status='staged')
        # Device picks this up on its own next GET /models/latest poll —
        # no push notification needed, matches ADD §12.5's OTA design
    else:
        mlflow_keep_staging(new_model)
        raise_blocker_report(
          "Retrained model failed promotion gate",
          f"held_out_auc={auc}, required >=0.85 and >={production_model.auc}")
```

🟢 Every step here maps directly to a specific ADD section or an earlier Phase B document (cited inline) — this script is genuinely just gluing already-specified pieces together in the right order, not introducing new undefined behavior.

---

## Phase B completion

Registry #18 is now fully resolved (cloud consumption shape from B.3, computation mechanism from this document). **All 26 Parameter Registry entries are resolved.** Phase B is complete: four technical specifications (AI/ML, Firmware/RTOS, Backend/Cloud, Local MLOps) collectively turn every qualitative statement Phase A found in the frozen ADD into an exact, implementable algorithm, schema, or pseudocode — with every value's confidence level marked, every safety-critical decision flagged for sign-off, and every genuine unknown (the relay's real mechanical limit, MQ135's real calibration coefficients) honestly left for real hardware data rather than fabricated.

**Next: Phase C (methodology finalization) and Phase D (the per-session implementation specs) — per the original phasing plan.**
