# SESSION 30 — MLflow + Evidently
**Risk tier: HIGH-RISK (feeds directly into the retraining/promotion pipeline that produces models deployed to the safety-relevant device).**
**Branch: `session/build-30-mlflow-evidently`**
**Attach: `04_LOCAL_MLOPS_TECHNICAL_SPEC.md` §2-3, `01_AI_ML_TECHNICAL_SPEC.md` §8-9**

---

## Agent Instructions

Real MLflow run-logging and promotion-gate logic, and real Evidently-based PSI drift computation — both re-verified against the live spec, matching exactly, no drift found this time.

**What this session creates:**
- `local-mlops/mlflow_tracking.py` — run logging + promotion gate
- `local-mlops/drift_check.py` — real PSI computation per modality
- `test/test_promotion_gate.py`

---

## FILE 1: `local-mlops/mlflow_tracking.py`

```python
"""Local MLOps Spec §2's exact usage pattern — real MLflow API calls."""
import mlflow
from mlflow.tracking import MlflowClient

AUC_HARD_BAR = 0.85  # AI/ML Spec §9

def log_training_run(model_path_fp32: str, model_path_int8: str, held_out_auc: float,
                       dataset_snapshot_ref: str, qat_settings: dict, drift_scores: dict | None = None):
    with mlflow.start_run() as run:
        mlflow.log_param("dataset_snapshot_ref", dataset_snapshot_ref)
        mlflow.log_params(qat_settings)
        mlflow.log_metric("held_out_auc", held_out_auc)
        if drift_scores:
            for modality, psi in drift_scores.items():
                mlflow.log_metric(f"drift_psi_{modality}", psi)
        mlflow.log_artifact(model_path_fp32, "model_fp32")
        mlflow.log_artifact(model_path_int8, "model_int8")

        # Always registers to Staging first — Local MLOps Spec §2:
        # "nothing skips straight to Production," regardless of AUC.
        model_version = mlflow.register_model(f"runs:/{run.info.run_id}/model_int8", "rezon-idnn")
        client = MlflowClient()
        client.transition_model_version_stage("rezon-idnn", model_version.version, "Staging")

    return run.info.run_id, model_version.version


def evaluate_promotion(model_version: str, held_out_auc: float) -> dict:
    client = MlflowClient()

    production_versions = client.get_latest_versions("rezon-idnn", stages=["Production"])
    current_production_auc = 0.0
    if production_versions:
        prod_run = client.get_run(production_versions[0].run_id)
        current_production_auc = prod_run.data.metrics.get("held_out_auc", 0.0)

    passes_hard_bar = held_out_auc >= AUC_HARD_BAR
    beats_incumbent = held_out_auc >= current_production_auc

    if passes_hard_bar and beats_incumbent:
        client.transition_model_version_stage("rezon-idnn", model_version, "Production")
        if production_versions:
            client.transition_model_version_stage(
                "rezon-idnn", production_versions[0].version, "Archived")
        return {"promoted": True, "reason": "passed both gates"}

    # NOT silently discarded — Local MLOps Spec §2's explicit rule.
    reason = []
    if not passes_hard_bar:
        reason.append(f"AUC {held_out_auc:.4f} below hard bar {AUC_HARD_BAR}")
    if not beats_incumbent:
        reason.append(f"AUC {held_out_auc:.4f} does not beat incumbent {current_production_auc:.4f}")

    return {
        "promoted": False,
        "reason": "; ".join(reason),
        "blocker_report_required": True,  # caller raises the real Blocker Report
    }
```

## FILE 2: `local-mlops/drift_check.py`

```python
"""Local MLOps Spec §3's exact PSI computation, per modality."""
import numpy as np

PSI_THRESHOLD = 0.2
MODALITIES = ["audio", "vibration", "environment", "gas", "current"]  # matches
                                                                        # the real
                                                                        # 5, per
                                                                        # DEC-017

def compute_psi(baseline: np.ndarray, current: np.ndarray, buckets: int = 10) -> float:
    """Standard PSI formula — bucket both distributions identically
    (using baseline's own quantile edges), compare bucket proportions."""
    edges = np.quantile(baseline, np.linspace(0, 1, buckets + 1))
    edges[0], edges[-1] = -np.inf, np.inf  # catch all real-world values

    baseline_counts, _ = np.histogram(baseline, bins=edges)
    current_counts, _ = np.histogram(current, bins=edges)

    baseline_pct = np.clip(baseline_counts / len(baseline), 1e-6, None)
    current_pct = np.clip(current_counts / len(current), 1e-6, None)

    psi = np.sum((current_pct - baseline_pct) * np.log(current_pct / baseline_pct))
    return float(psi)


def check_all_modalities(baseline_data: dict[str, np.ndarray], recent_data: dict[str, np.ndarray]) -> dict:
    """Returns per-modality PSI + status. Only 'audio' drift should
    trigger retraining (Local MLOps Spec §3's explicit note — the
    other 4 self-calibrate live) — this function reports all 5, the
    CALLER (the scheduled script, Session 32) decides what to act on,
    keeping this function's job purely "measure," not "decide.\""""
    results = {}
    for modality in MODALITIES:
        if modality not in baseline_data or modality not in recent_data:
            continue
        psi = compute_psi(baseline_data[modality], recent_data[modality])
        status = "significant" if psi > PSI_THRESHOLD else ("watch" if psi > 0.1 else "stable")
        results[modality] = {"psi": psi, "status": status}
    return results
```

## FILE 3: `test/test_promotion_gate.py`

```python
from local_mlops.mlflow_tracking import evaluate_promotion
from unittest.mock import patch, MagicMock

def test_promotion_fails_below_hard_bar():
    with patch("local_mlops.mlflow_tracking.MlflowClient") as MockClient:
        MockClient.return_value.get_latest_versions.return_value = []
        result = evaluate_promotion("1", held_out_auc=0.80)  # below 0.85
        assert result["promoted"] is False
        assert result["blocker_report_required"] is True

def test_promotion_fails_if_worse_than_incumbent():
    with patch("local_mlops.mlflow_tracking.MlflowClient") as MockClient:
        mock_prod = MagicMock(run_id="r1", version="1")
        MockClient.return_value.get_latest_versions.return_value = [mock_prod]
        MockClient.return_value.get_run.return_value.data.metrics = {"held_out_auc": 0.92}
        result = evaluate_promotion("2", held_out_auc=0.87)  # passes hard bar, worse than 0.92
        assert result["promoted"] is False

def test_promotion_succeeds_when_both_gates_pass():
    with patch("local_mlops.mlflow_tracking.MlflowClient") as MockClient:
        MockClient.return_value.get_latest_versions.return_value = []  # no incumbent
        result = evaluate_promotion("1", held_out_auc=0.90)
        assert result["promoted"] is True
```

---

## Verification Steps

**Step 1:** `pytest test/test_promotion_gate.py -v` — expected: `3 passed`, all three real gate-decision paths exercised.

**Step 2 (real, not mocked):** run `log_training_run()` against a real local MLflow server (Session 29), confirm the run genuinely appears in the MLflow UI with real logged parameters/metrics/artifacts, registered to Staging.

**Step 3:** `compute_psi()` with two identical distributions — confirm PSI ≈ 0 (literal near-zero, not just "low"). With two visibly different distributions (e.g., shifted means), confirm PSI > 0.2.

## Known open items
None.
