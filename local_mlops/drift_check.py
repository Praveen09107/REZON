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
    keeping this function's job purely "measure," not "decide." """
    results = {}
    for modality in MODALITIES:
        if modality not in baseline_data or modality not in recent_data:
            continue
        psi = compute_psi(baseline_data[modality], recent_data[modality])
        status = "significant" if psi > PSI_THRESHOLD else ("watch" if psi > 0.1 else "stable")
        results[modality] = {"psi": psi, "status": status}
    return results
