"""
The real calibration pass — AI/ML Spec §4's gas-compensation fit and
§7.2's post-burn-in fusion weight recalculation, both using real
accumulated burn-in telemetry for the first time.
"""
import numpy as np
from sklearn.linear_model import LinearRegression

def fit_gas_compensation(burnin_data: list[dict]) -> tuple[float, float]:
    """AI/ML Spec §4: fit k_temp, k_humidity via linear regression
    against observed baseline drift — real data now exists, replacing
    the 0.0 defaults that shipped since Session 4."""
    T_REF, H_REF = 20.0, 65.0
    X = np.array([[row["env_temp"] - T_REF, row["env_humidity"] - H_REF] for row in burnin_data])
    y = np.array([row["gas_raw_mv"] for row in burnin_data])

    baseline_mean = np.mean(y)
    y_relative = (y - baseline_mean) / baseline_mean  # fit the CORRECTION factor, not raw mv

    model = LinearRegression().fit(X, y_relative)
    k_temp, k_humidity = model.coef_[0], model.coef_[1]

    print(f"Fitted gas compensation: k_temp={k_temp:.4f}, k_humidity={k_humidity:.4f} "
          f"(replacing the 0.0 defaults from Session 4)")
    return float(k_temp), float(k_humidity)


def recalculate_fusion_weights(burnin_scores: dict[str, list[float]]) -> dict[str, float]:
    """AI/ML Spec §7.2: w_i ∝ 1/variance_i — a modality with a tighter,
    more stable baseline during burn-in gets proportionally more weight."""
    variances = {modality: np.var(scores) for modality, scores in burnin_scores.items()}
    inv_variances = {m: 1.0 / max(v, 1e-6) for m, v in variances.items()}
    total = sum(inv_variances.values())
    weights = {m: iv / total for m, iv in inv_variances.items()}

    print("Recalculated fusion weights (replacing Session 7's equal 0.2 defaults):")
    for m, w in weights.items():
        print(f"  {m}: {w:.4f} (burn-in variance: {variances[m]:.4f})")
    return weights


def verify_stopping_rule_genuinely_met(burnin_data: list[dict], days_elapsed: int) -> bool:
    """Re-verify AI/ML Spec §10's stopping rule directly from real data
    before proceeding — this function existing and being called is the
    difference between 'a week has passed' and 'the actual documented
    criteria are genuinely satisfied,' which are not the same claim."""
    if days_elapsed < 7:
        print(f"FAIL: only {days_elapsed} days elapsed, minimum 7 required")
        return False

    # Check per-modality 24h rolling stability (§10's third condition)
    for modality in ["audio", "vibration", "environment", "gas", "current"]:
        recent = [r[f"{modality}_score"] for r in burnin_data[-1440:]]  # ~last 24h
        prior = [r[f"{modality}_score"] for r in burnin_data[-2880:-1440]]  # prior 24h
        if not recent or not prior:
            print(f"FAIL: insufficient data for {modality} stability check")
            return False
        recent_std, prior_std = np.std(recent), np.std(prior)
        relative_change = abs(recent_std - prior_std) / max(prior_std, 1e-6)
        if relative_change >= 0.10:
            print(f"FAIL: {modality} baseline not stabilized ({relative_change:.1%} change, need <10%)")
            return False

    print("PASS: stopping rule genuinely satisfied — proceeding to calibration.")
    return True
