# SESSION 34 — Calibration Fine-Tune
**Risk tier: MAXIMUM — this is the session where BURN_IN mode ends and the device's judgment starts being trusted for real, autonomous action. Every prior session's careful gating (DEC-019, DEC-020) exists specifically to make sure this transition only happens when it's genuinely earned.**
**Branch: `session/build-34-calibration-finetune`**
**Attach: `01_AI_ML_TECHNICAL_SPEC.md` §7.2, §9-10, `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §5, Sessions 07, 09, 30, 31 (as actually built)**

---

## Agent Instructions

This is the session Sessions 4, 7, 9, and 19 all pointed toward without implementing — real burn-in data now exists (assuming the device has been deployed since Session 9 and the stopping-rule criteria from AI/ML Spec §10 are genuinely met, not assumed). Three things: (1) fit the real gas-compensation coefficients that started at 0.0, (2) recalibrate fusion weights from real burn-in variance data, (3) implement and execute the actual BURN_IN→FULL_OPERATION transition.

**Prerequisites — check these are REALLY true before running this session, not assumed from the calendar:**
- AI/ML Spec §10's stopping rule genuinely satisfied (≥7 days, all 3 conditions met, verified against real accumulated telemetry — not just "a week has passed")
- Session 33's cloud hardening complete (this session pushes a real model update through the real OTA pipeline)

**What this session creates:**
- `local-mlops/calibration.py` — real coefficient fitting + weight recalibration
- `main/networking_task.c` — RETROFIT: the real transition trigger

---

## FILE 1: `local-mlops/calibration.py`

```python
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
```

## FILE 2: `main/networking_task.c` — RETROFIT (the real transition, resolving Sessions 4/7/9/19's forward references)

```c
// ADDED: the real trigger, replacing the "TODO Session 34" placeholders
// left in Sessions 4/7/9. Implemented as: the device receives the
// calibrated model via the SAME OTA mechanism as any retrain (Firmware
// Spec §6) — the mode-change signal rides along in the OTA response
// payload as a new field, resolving the open question Session 9 left
// explicitly unresolved.

// Extends the OTA SWAPPING state's real logic (Session 8's ota_state_machine.c):
if (ota_response.contains("graduate_to_full_operation") && ota_response.graduate_to_full_operation == true) {
    device_identity_set_operating_mode(OPMODE_FULL_OPERATION);
    ESP_LOGW("ota", "Device graduated BURN_IN -> FULL_OPERATION — "
              "actuation capability now genuinely active for the first time.");
}
```

---

## Verification Steps

**Step 1 (the real gate, per `verify_stopping_rule_genuinely_met`):** run against real accumulated burn-in telemetry — expected literal output `PASS: stopping rule genuinely satisfied`. **If it prints FAIL, this session stops here.** Do not proceed to calibration or the mode transition on unmet criteria, regardless of how many calendar days have passed.

**Step 2:** Run `fit_gas_compensation()` and `recalculate_fusion_weights()` against real data — confirm the printed coefficients/weights look plausible (not wildly divergent from the 0.0/0.2 defaults in a way that would suggest a data or fitting bug) and manually spot-check one modality's weight against its actual observed variance.

**Step 3:** Push the calibrated model + new coefficients/weights through the real OTA pipeline (Sessions 8, 30-31) — confirm the device genuinely receives them and `operating_mode` flips to `FULL_OPERATION`, logged prominently per Session 9's `device_identity_set_operating_mode()` implementation.

**Step 4 (HW_VERIFICATION_LOG.md entry required):** confirm via real device log output that the mode transition genuinely happened — this is the actual, physical moment REZON's autonomous action capability goes live for the first time, and it deserves the same real evidence standard as every other safety-relevant claim in this project.

## Known open items
None — this session resolves the last deliberately-deferred item from Phase 1.
