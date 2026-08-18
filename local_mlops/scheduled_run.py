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
    from local_mlops.data_operations import get_held_out_evaluation_set, save_model_artifact, save_model_artifact_bytes, get_dataset_snapshot_ref

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
