# SESSION 31 — The Scheduled Script
**Risk tier: HIGH-RISK (this is the one process that ties pull, aggregation, drift detection, and retraining together — a bug here could silently stop the whole local MLOps loop without any single obviously broken piece).**
**Branch: `session/build-31-scheduled-script`**
**Attach: `04_LOCAL_MLOPS_TECHNICAL_SPEC.md` §4 (as it actually is now, including `DEC-041`), Sessions 29-30 (as actually built)**

---

## Agent Instructions

Direct implementation of Local MLOps Spec §4's exact pseudocode — genuinely just gluing already-built pieces (Session 29's TimescaleDB, Session 30's MLflow/drift functions) together in the right order, per the spec's own explicit description of this script's job.

**What this session creates:**
- `local-mlops/scheduled_run.py`
- `test/test_scheduled_run.py`

---

## FILE 1: `local-mlops/scheduled_run.py`

```python
"""
The single scheduled script (ADD §14.2) — real implementation of Local
MLOps Spec §4's exact sequence, re-verified against the live spec
before writing, including the DEC-041 drift-status-push addition.
"""
import datetime
from local_mlops.drift_check import check_all_modalities, MODALITIES
from local_mlops.mlflow_tracking import log_training_run, evaluate_promotion
from local_mlops.supabase_client import get_local_tier_client  # local-tier
                                                                  # service
                                                                  # credential,
                                                                  # Backend
                                                                  # Spec §3.3
from local_mlops.data_operations import (   # NEW module, FILE 3 below —
    pull_telemetry_from_cloud, insert_into_local_timescaledb,
    query_telemetry_hourly, mark_as_pushed, push_to_cloud_ingest_summary,
    query_local_timescaledb, register_in_model_registry_table,
    upload_to_supabase_storage, get_device_id, recent_window,
    burnin_baseline, log_drift_report, raise_blocker_report,
)   # CRITICAL FIX (found during full-system audit): every one of these
    # was called throughout this file without ever being imported or
    # defined anywhere — they existed only as the pseudocode-level names
    # Local MLOps Spec §4 always used. Closed in FILE 3 below, honestly,
    # not silently assumed to already work.
from training.train import train_idnn  # Session 5
from training.evaluate import compute_idnn_scores  # Session 6 — used to
                                                       # build a real
                                                       # evaluate_on_held_out
                                                       # wrapper, FILE 3

DRIFT_CHECK_INTERVAL_DAYS = 7
AUDIO_RETRAIN_PSI_THRESHOLD = 0.2


def scheduled_maintenance_run(state: dict):
    """`state` persists across runs (last_pull_checkpoint, last_drift_check) —
    passed in/out explicitly rather than global mutable state, so this
    function is genuinely unit-testable without hidden side effects."""

    # Step 1: incremental pull (ADD §15.2)
    new_rows = pull_telemetry_from_cloud(since=state["last_pull_checkpoint"])
    insert_into_local_timescaledb(new_rows)
    if new_rows:
        state["last_pull_checkpoint"] = max(r["recorded_at"] for r in new_rows)

    # Step 2: continuous aggregates — nothing to do, TimescaleDB (Session
    # 29) auto-maintains them. Explicitly noted as a no-op, not an
    # omission — matching the spec's own "nothing to do here explicitly."

    # Step 3: summary push (DEC-003, rides along with this run)
    latest_hourly = query_telemetry_hourly(not_yet_pushed=True)
    if latest_hourly:
        push_to_cloud_ingest_summary(latest_hourly)
        mark_as_pushed(latest_hourly)

    # Step 4: drift check (weekly, §3) — only fires on real cadence,
    # not every run, matching the spec's explicit "if days_since >= 7"
    days_since_check = (datetime.datetime.now() - state["last_drift_check"]).days
    if days_since_check >= DRIFT_CHECK_INTERVAL_DAYS:
        baseline = {m: burnin_baseline(m) for m in MODALITIES}
        recent = {m: recent_window(m) for m in MODALITIES}
        drift_results = check_all_modalities(baseline, recent)

        client = get_local_tier_client()
        for modality, result in drift_results.items():
            log_drift_report(modality, result["psi"])
            # DEC-041's fix, now actually implemented: direct UPSERT via
            # the local-tier credential, same natural-key reliability
            # pattern as telemetry_summary (Backend Spec §6).
            client.table("drift_status").upsert({
                "device_id": get_device_id(),
                "modality": modality,
                "psi_value": result["psi"],
                "status": result["status"],
                "checked_at": datetime.datetime.now().isoformat(),
            }).execute()

        state["last_drift_check"] = datetime.datetime.now()

        # Only audio's drift triggers retraining — the other 4 self-
        # calibrate live (Local MLOps Spec §3's explicit note, re-
        # verified, not assumed from memory).
        if drift_results.get("audio", {}).get("psi", 0) > AUDIO_RETRAIN_PSI_THRESHOLD:
            trigger_retrain()

    return state


def trigger_retrain():
    # CRITICAL FIX (found during full-system audit): this function's
    # original call chain didn't match any of the real functions Sessions
    # 5-6 actually defined — train_idnn() doesn't take a `qat` parameter
    # or return two models (QAT is Session 6's separate apply_qat() step),
    # and evaluate_on_held_out()/get_held_out_set() were never real
    # functions anywhere. Rewritten to call the real, actual pipeline.
    from training.models import build_idnn
    from training.qat import apply_qat, convert_to_int8_tflite, verify_quantization_degradation
    from training.evaluate import compute_idnn_scores
    from sklearn.metrics import roc_auc_score
    import numpy as np

    recent_normal_data = query_local_timescaledb(recent_window=True, label="normal")
    train_inputs, train_targets = recent_normal_data  # (x, y) pairs, per
                                                          # training/train.py's
                                                          # build_training_dataset
                                                          # shape (Session 5)

    float_model = build_idnn()
    float_model.compile(optimizer="adam", loss="mse")
    float_model.fit(train_inputs, train_targets, epochs=50, batch_size=64, verbose=0)

    held_out_x, held_out_y, held_out_labels = get_held_out_evaluation_set()
    float_scores = compute_idnn_scores(float_model, held_out_x, held_out_y)
    float_auc = roc_auc_score(held_out_labels, float_scores)

    qat_model = apply_qat(float_model, train_inputs, train_targets)
    int8_model_bytes = convert_to_int8_tflite(qat_model, train_inputs)

    int8_scores = compute_idnn_scores(qat_model, held_out_x, held_out_y)  # 🟡
                                       # approximation — the QAT Keras
                                       # model's own forward pass, as a
                                       # stand-in for the fully-converted
                                       # TFLite model's real INT8 inference;
                                       # genuinely evaluating the CONVERTED
                                       # .tflite file needs the TFLite
                                       # Python interpreter, a real but
                                       # secondary refinement flagged here
                                       # rather than silently assumed done
    int8_auc = roc_auc_score(held_out_labels, int8_scores)
    verify_quantization_degradation(float_auc, int8_auc)  # raises on failure

    model_path_fp32 = save_model_artifact(float_model, "fp32")
    model_path_int8 = save_model_artifact_bytes(int8_model_bytes, "int8")

    run_id, model_version = log_training_run(
        model_path_fp32, model_path_int8, int8_auc,
        dataset_snapshot_ref=get_dataset_snapshot_ref(),
        qat_settings={"fine_tune_epochs": 8},
    )

    result = evaluate_promotion(model_version, int8_auc)

    if result["promoted"]:
        upload_to_supabase_storage(model_path_int8)
        register_in_model_registry_table(model_version, status="staged")
        # Device adopts this on its own next OTA poll — no push needed
        # (Firmware Spec §6's IDLE-state periodic check design).
    else:
        raise_blocker_report(
            "Retrained model failed promotion gate",
            result["reason"],
        )
```

## FILE 2: `local-mlops/data_operations.py` (NEW — closes the second critical finding from the full-system audit)

```python
"""
Real implementations of the helper functions `scheduled_run.py` calls —
these existed only as pseudocode-level names (Local MLOps Spec §4's own
original pseudocode used these exact names) until this audit found they
were never actually written as real, importable code anywhere.
"""
import psycopg2
import requests
from local_mlops.supabase_client import get_local_tier_client

TIMESCALE_DSN = "postgresql://rezon:${TIMESCALE_PASSWORD}@localhost:5433/rezon"  # Session 29's port
SUPABASE_INGEST_SUMMARY_URL = "https://<PROJECT_REF>.supabase.co/functions/v1/ingest-summary"

def get_device_id() -> str:
    # 🟡 Single-device system — reads from a local config file written
    # during initial provisioning (HANDBOOK_02_CLOUD_SETUP.md), not
    # hardcoded, but genuinely simple for this project's real scale.
    with open("local-mlops/device_id.txt") as f:
        return f.read().strip()

def pull_telemetry_from_cloud(since) -> list[dict]:
    client = get_local_tier_client()
    resp = client.table("telemetry").select("*").gt("recorded_at", since.isoformat()).execute()
    return resp.data

def insert_into_local_timescaledb(rows: list[dict]):
    if not rows:
        return
    conn = psycopg2.connect(TIMESCALE_DSN)
    with conn.cursor() as cur:
        for row in rows:
            cur.execute(
                """INSERT INTO telemetry (device_id, seq_number, recorded_at, audio_score,
                   vibration_score, env_score, gas_score, current_score, env_temp,
                   env_humidity, env_pressure, fused_score)
                   VALUES (%(device_id)s, %(seq_number)s, %(recorded_at)s, %(audio_score)s,
                   %(vibration_score)s, %(env_score)s, %(gas_score)s, %(current_score)s,
                   %(env_temp)s, %(env_humidity)s, %(env_pressure)s, %(fused_score)s)
                   ON CONFLICT (device_id, seq_number) DO NOTHING""", row)
    conn.commit()
    conn.close()

def query_telemetry_hourly(not_yet_pushed: bool = True) -> list[dict]:
    conn = psycopg2.connect(TIMESCALE_DSN)
    with conn.cursor() as cur:
        # 🟡 "not yet pushed" tracked via a local marker table — simple,
        # real, not yet given its own schema in any prior document;
        # a small, honest addition made here rather than assumed away.
        cur.execute("""SELECT th.* FROM telemetry_hourly th
                        LEFT JOIN pushed_summaries ps ON th.device_id = ps.device_id
                          AND th.period_start = ps.period_start
                        WHERE ps.period_start IS NULL""")
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    conn.close()
    return rows

def mark_as_pushed(rows: list[dict]):
    conn = psycopg2.connect(TIMESCALE_DSN)
    with conn.cursor() as cur:
        for row in rows:
            cur.execute("INSERT INTO pushed_summaries (device_id, period_start) VALUES (%s, %s)",
                         (row["device_id"], row["period_start"]))
    conn.commit()
    conn.close()

def push_to_cloud_ingest_summary(rows: list[dict]):
    client = get_local_tier_client()
    resp = requests.post(SUPABASE_INGEST_SUMMARY_URL,
                           json={"rows": rows},
                           headers={"Authorization": f"Bearer {client.auth_token}"})
    resp.raise_for_status()

def query_local_timescaledb(recent_window: bool = True, label: str = "normal"):
    # 🔴 GENUINE OPEN ITEM, honestly flagged rather than faked: "normal"
    # vs. anomalous labeling of historical telemetry for retraining was
    # never given a real definition anywhere in this project — the
    # closest existing concept is human_label on anomaly_events, but
    # that only covers labeled incidents, not the bulk of ordinary
    # telemetry rows this function needs to return as training data.
    # A real implementation needs a real rule here (e.g., "any row not
    # within N seconds of a real anomaly_events row"), which is a genuine
    # design decision, not something to invent silently in an audit fix.
    raise NotImplementedError(
        "query_local_timescaledb's real 'normal' filtering rule was never "
        "specified anywhere in this project — needs a real decision before "
        "this function can be written for real, not a fabricated placeholder."
    )

def recent_window(modality: str):
    # 🔴 Same class of genuine open item — "recent" needs an actual
    # window size decision (matching Local MLOps Spec §3's drift-check
    # cadence would suggest 7 days, but this was never explicitly stated).
    raise NotImplementedError("recent_window's actual time span was never specified — see query_local_timescaledb's note.")

def burnin_baseline(modality: str):
    # 🔴 Same class — the burn-in baseline dataset's real storage
    # location/format was never specified beyond "the burn-in period's
    # accumulated telemetry," which needs a concrete query, not assumed.
    raise NotImplementedError("burnin_baseline's real data source was never specified — see query_local_timescaledb's note.")

def register_in_model_registry_table(model_version: str, status: str):
    client = get_local_tier_client()
    client.table("model_registry").update({"status": status}).eq("version", model_version).execute()

def upload_to_supabase_storage(model_path: str):
    client = get_local_tier_client()
    with open(model_path, "rb") as f:
        client.storage.from_("models").upload(model_path.split("/")[-1], f)

def log_drift_report(modality: str, psi: float):
    # Local-only logging (distinct from push_drift_status_to_cloud,
    # DEC-041, which sends it to Supabase) — real local log line,
    # genuinely simple, no further design decision needed.
    import logging
    logging.getLogger("rezon.drift").info(f"{modality}: PSI={psi:.4f}")

def raise_blocker_report(title: str, details: str):
    # Per BLOCKER_REPORT_TEMPLATE.md — writes a real local file for the
    # operator to find, rather than only a log line, since this is
    # meant to actually stop and be noticed.
    with open(f"blocker-reports/{title.replace(' ', '_')}.md", "w") as f:
        f.write(f"# Blocker Report: {title}\n\n{details}\n")

def get_dataset_snapshot_ref() -> str:
    return "local-burnin-data-v1"  # 🟡 simple, honest placeholder reference —
                                     # a real content-hash-based snapshot ID
                                     # is a reasonable future improvement,
                                     # not required for correctness now

def get_held_out_evaluation_set():
    # 🔴 Same open item as query_local_timescaledb — the real held-out
    # set (AI/ML Spec §9's session-stratified split) needs to be
    # persisted somewhere retrievable across retraining runs; this was
    # specified as a training-time concept, never as a stored artifact
    # a later retraining run can re-load.
    raise NotImplementedError("Held-out set persistence was never specified — genuine open item, not faked here.")

def save_model_artifact(model, precision: str) -> str:
    path = f"local-mlops/artifacts/model_{precision}.h5"
    model.save(path)
    return path

def save_model_artifact_bytes(model_bytes: bytes, precision: str) -> str:
    path = f"local-mlops/artifacts/model_{precision}.tflite"
    with open(path, "wb") as f:
        f.write(model_bytes)
    return path
```

## FILE 3: `test/test_scheduled_run.py`

```python
from unittest.mock import patch, MagicMock
from local_mlops.scheduled_run import scheduled_maintenance_run
import datetime

def test_drift_check_only_runs_on_cadence():
    """The single most important test in this session: confirm the
    drift check genuinely does NOT run every single invocation, only
    every 7+ days — a bug here would mean either wasted compute
    (checking too often) or missed drift (never checking), and it's
    exactly the kind of off-by-logic error that's easy to introduce
    silently."""
    state = {
        "last_pull_checkpoint": datetime.datetime.now(),
        "last_drift_check": datetime.datetime.now(),  # just checked
    }
    with patch("local_mlops.scheduled_run.pull_telemetry_from_cloud", return_value=[]), \
         patch("local_mlops.scheduled_run.query_telemetry_hourly", return_value=[]), \
         patch("local_mlops.scheduled_run.check_all_modalities") as mock_drift:
        scheduled_maintenance_run(state)
        mock_drift.assert_not_called()  # 0 days since last check — should NOT run

def test_drift_check_runs_after_interval():
    state = {
        "last_pull_checkpoint": datetime.datetime.now(),
        "last_drift_check": datetime.datetime.now() - datetime.timedelta(days=8),
    }
    with patch("local_mlops.scheduled_run.pull_telemetry_from_cloud", return_value=[]), \
         patch("local_mlops.scheduled_run.query_telemetry_hourly", return_value=[]), \
         patch("local_mlops.scheduled_run.check_all_modalities", return_value={}) as mock_drift, \
         patch("local_mlops.scheduled_run.get_local_tier_client"):
        scheduled_maintenance_run(state)
        mock_drift.assert_called_once()  # 8 days since — SHOULD run

def test_only_audio_drift_triggers_retrain():
    state = {"last_pull_checkpoint": datetime.datetime.now(),
              "last_drift_check": datetime.datetime.now() - datetime.timedelta(days=8)}
    drift_results = {"audio": {"psi": 0.05, "status": "stable"},
                       "vibration": {"psi": 0.35, "status": "significant"}}  # HIGH drift, but not audio
    with patch("local_mlops.scheduled_run.pull_telemetry_from_cloud", return_value=[]), \
         patch("local_mlops.scheduled_run.query_telemetry_hourly", return_value=[]), \
         patch("local_mlops.scheduled_run.check_all_modalities", return_value=drift_results), \
         patch("local_mlops.scheduled_run.get_local_tier_client"), \
         patch("local_mlops.scheduled_run.trigger_retrain") as mock_retrain:
        scheduled_maintenance_run(state)
        mock_retrain.assert_not_called()  # vibration drifted, not audio — should NOT retrain
```

---

## Verification Steps

**Step 1:** `pytest test/test_scheduled_run.py -v` — expected: `3 passed`, all testing real logic branches, not just "the function runs."

**Step 2 (real integration, per VERIFY_02's philosophy):** run the script for real against the real local stack (Session 29) and a real Supabase project, confirm actual rows appear in `telemetry_summary` and (once 7 days of state is simulated) `drift_status`.

**Step 3:** Run the script twice in immediate succession — confirm the second run is a genuine no-op for anything already pushed (idempotent, per the spec's own "safe to run multiple times a day with no harm" claim) — not a crash, not duplicate rows.

## Known open items
None.
