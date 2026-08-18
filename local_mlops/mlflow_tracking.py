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
