# REZON — AI/ML Technical Specification
**Phase B.1. Resolves Parameter Registry entries #1-3, #7-15. Safety-critical: thresholds/corroboration values here feed directly into the actuation gate (Firmware Spec, Phase B.2). ✅ Developer sign-off obtained — see `DEC-015`. This document's actuation-related content is CONFIRMED, not analysis-only.**

**Confidence key used throughout:** 🟢 standard practice / high confidence — 🟡 reasonable engineering default, empirically validate in Phase 1 — 🔴 cannot be determined without real hardware/datasheet data in hand; algorithm specified precisely, exact constants deferred to that data.

---

## 1. Audio pipeline — signal parameters

| Parameter | Value | Confidence | Justification |
|---|---|---|---|
| Sample rate | 16 kHz | 🟢 | Mechanical/acoustic anomaly signatures are predominantly <8kHz; matches DCASE reference implementations; keeps I2S DMA throughput modest (~32KB/s raw) |
| Frame (window) size | 1024 samples (64ms) | 🟢 | Standard FFT window size for this sample rate, good time/frequency resolution trade-off |
| Hop size | 512 samples (50% overlap) | 🟢 | Standard overlap ratio for spectrogram smoothness |
| FFT size | 512-point real FFT | 🟢 | Matches frame size, gives 257 usable frequency bins pre-mel-binning |
| Mel filterbank | 40 bins, 0-8kHz | 🟢 | Standard for audio ML at MCU scale (matches DCASE/MLPerf Tiny reference designs); 8kHz upper bound = Nyquist for 16kHz sampling |
| Post-mel compression | log(mel_energy + ε), ε=1e-6 | 🟢 | Standard log-mel; epsilon prevents log(0) |

## 2. IDNN — exact architecture

**Input construction:** stack `C=3` context frames before + `C=3` after the target frame (6 context frames total, center frame excluded from input, held out as the prediction target). Input shape: 40 mel bins × 6 frames = **240 values**, flattened. Output: the masked center frame's 40 mel values.

🟡 *`C=3` (±3 frames ≈ ±96ms of context) is a reasonable engineering default — enough temporal context to capture the onset of a short transient event without an oversized receptive field. This is a parameter to empirically validate: if the A/B against the plain-autoencoder baseline (§8) doesn't clearly favor IDNN, revisit `C` before concluding IDNN loses.*

**Architecture (fully-connected, matching the DCASE IDNN reference pattern — not convolutional, since a 240-value input patch is too small to benefit meaningfully from conv locality):**

```
Encoder:
  Input(240) → Dense(128) → ReLU
             → Dense(64)  → ReLU
             → Dense(16)  → ReLU      # bottleneck

Decoder:
  Dense(16) → Dense(64)  → ReLU
            → Dense(128) → ReLU
            → Dense(40)  → Linear     # predicted center-frame mel values
```

🟢 Parameter count ≈ 55K (well within MCU footprint even pre-quantization; comfortably meets the "same size class as a small autoencoder" claim in ADD §9.2). 🟡 Bottleneck width (16) is a standard ~15:1 compression ratio for this input size — a reasonable default, not empirically tuned yet.

**Anomaly score:** mean-squared-error between predicted and actual center-frame mel values. 🟢

**Baseline for the A/B (§9.2's "hypothesis, not fact" framing):** identical encoder/decoder shape, but trained as a plain autoencoder (input = full 7-frame patch including center, reconstructs all 7 frames, MSE over the whole patch is the score). Same parameter budget, different task framing — this is the actual controlled comparison.

## 3. Vibration — spectral band definition

🔴→🟢 **Correction to earlier project documents:** an earlier draft referenced 100Hz vibration sampling to resolve bands up to 100Hz — that violates Nyquist (100Hz sampling only resolves up to 50Hz). Corrected here to 250Hz rather than the bare 200Hz Nyquist minimum, for practical margin away from the aliasing boundary at the 100Hz band edge.

| Parameter | Value | Confidence |
|---|---|---|
| Vibration sample rate | 250 Hz | 🟢 (bare Nyquist minimum for 100Hz content is 200Hz; 250Hz adds practical margin) |
| FFT window | 128 samples (0.64s) | 🟡 reasonable default for band-energy resolution at this rate |
| Analysis cadence | every 1s (matches inference cycle, §6) | 🟡 |
| Band 1 (low) | 0-10 Hz | 🟡 general imbalance/structural |
| Band 2 (mid) | 10-50 Hz | 🟡 bearing/gear-mesh range |
| Band 3 (high) | 50-100 Hz | 🟡 high-frequency bearing defect range |

**Scoring (made explicit here — the underlying logic was already complete in the prose above, this adds the formula for consistency with §6's style, following a check during Session 4 planning that confirmed this wasn't actually a gap):**
```
For each band i in {low, mid, high}:
    maintain rolling (μ_i, σ_i) over that band's energy history
    z_i = (band_energy_i - μ_i) / σ_i

vibration_deviation = max(|z_low|, |z_mid|, |z_high|)
```
This scalar is what feeds §7.1's normalization — the same pattern as environment's max-deviation approach (§6), applied here for the same reason: a fault that redistributes energy into one band shouldn't be diluted by the other two staying calm.

**Note on RMS/peak-to-peak:** earlier informal descriptions of this modality mentioned these as additional features. They are not part of this document's scoring algorithm — the 3-band max-deviation above is the complete, sufficient computation. RMS/peak-to-peak may still be computed and displayed as supplementary frontend telemetry (Frontend Spec, Sensor Streams view) if useful, but are explicitly not required for the anomaly score itself.

## 4. Gas (MQ135) — compensation

🔴 **This one is deliberately NOT given fabricated numeric coefficients.** MQ135 compensation curves are batch/manufacturer-specific and belong in the actual datasheet shipped with the purchased unit — inventing plausible-looking numbers here would be a worse failure than specifying the algorithm precisely and leaving the constants for real calibration data.

**Algorithm (exact, constants deferred):**
```
corrected_reading = raw_reading × correction_factor
correction_factor = 1 + a×(T - T_ref) + b×(H - H_ref)

where:
  T_ref, H_ref = the temperature/humidity at which the sensor was
                 last known-calibrated (initially: burn-in start conditions)
  a, b = coefficients, INITIALIZED TO 0 (no compensation) until
         enough burn-in data exists to fit them via linear regression
         against observed raw-reading drift vs. (T, H) pairs
```
This means gas compensation is inactive (correction_factor = 1) for early burn-in, then activates once `a, b` are fit — itself a burn-in-calibrated parameter, consistent with ADD §10.4's framing. **Action item for Phase 1:** pull the actual MQ135 datasheet compensation curve if the purchased unit's documentation provides one; if it does, use those published coefficients instead of the burn-in-fit fallback.

## 5. Current (ACS712) — filtering

🟡 Single-stage **exponential moving average (EMA)**, not a separate moving-average-then-alpha-filter stack (the ADD's "moving-average + alpha filter" language describes one filtering *concept*, implemented here as one clean, MCU-cheap operation):

```
filtered[n] = α × raw[n] + (1-α) × filtered[n-1]
α = 0.2
```

Justification: EMA needs one multiply-add per sample (no sample buffer required) — cheaper than a true moving average on an MCU. 🟡 α=0.2 balances noise suppression (the ACS712 5A's documented ~100mA noise floor) against responsiveness (a genuine current change should still show up within a few samples, not be smoothed away). **Empirically validate against a real known load during Phase 1 bring-up** — if genuine step-changes get too smoothed, raise α; if noise still leaks through, lower it.

Current sample rate: 🟡 100 Hz (10ms interval) — sufficient to catch a motor current transient without being wasteful.

## 6. Environment (DHT22+BMP280) — statistical scoring (gap found and closed during quality audit)

**This section did not exist until this audit caught it.** The ADD's own overview (§5.2: "audio via a neural network, the other four via self-calibrating statistical monitors") commits to environment being a genuinely scored modality, not just a gas-compensation input — a real, defensible design, since a sudden temperature or pressure excursion is itself a meaningful hazard signal (fire, HVAC failure, a door/window breach), independent of its role correcting MQ135. Sections 1-5 defined audio, vibration, gas, and current scoring but never defined environment's — an oversight, not a deliberate exclusion, caught and closed here.

🟡 **Algorithm (same pattern as vibration §3 — max deviation across sub-parameters, not average, so one parameter's anomaly isn't diluted by two calm ones):**
```
For each of {temperature, humidity, pressure}:
    maintain rolling (μ, σ) — same rolling-baseline mechanism as every
    other statistical modality
    z_param = (raw_param - μ_param) / σ_param

environment_deviation = max(|z_temp|, |z_humidity|, |z_pressure|)
```
This raw deviation feeds the same normalization as every other modality (§7.1's sigmoid transform), producing `normalized_score_environment` on the same (0,1) scale as audio/vibration/gas/current.

**Sample rate:** 🟡 uses DHT22/BMP280's existing polling rates (Firmware Spec §2) — no new sensor reads required, this section only adds the scoring math on top of readings already being taken for gas compensation.

## 7. Fusion — score normalization, weights, thresholds

### 7.1 Per-modality score normalization (makes all 5 scores comparable)

Each modality maintains a rolling mean (μ) and standard deviation (σ) over its own recent history:
```
z = (x - μ) / σ
normalized_score = sigmoid(z) = 1 / (1 + e^(-z))
```
🟢 This bounds every modality's score to (0, 1), with 0.5 = "exactly typical." Audio's score (IDNN prediction error) goes through the same normalization — its own rolling μ/σ of reconstruction error, not raw MSE directly.

### 7.2 Fusion weights

**Cold start (pre-burn-in-calibration):** 🟢 equal weights, `w = 0.2` for all 5 scored modalities (audio, vibration, environment, gas, current) — the only defensible unbiased default before any real calibration data exists (device is in logging-only mode during this period anyway per ADD §10.4, so cold-start weights never actually gate a real action).

**Post-burn-in:** weights recalibrated using burn-in data — 🟡 proposed method: `w_i ∝ 1 / variance_i` (a modality with a tighter, more stable baseline gets proportionally more weight, since deviations from a tight baseline are more meaningful signal than deviations from an already-noisy one), normalized so weights sum to 1.

**Current modality's actuation-specific boost:** per ADD §9.5's explicit design (current is weighted toward actuation specifically, since it's the only channel observing the actuation target directly): 🟡 apply a ×1.5 multiplier to current's normalized score *only when evaluating the actuation corroboration check* (§7.4), not the alert-level fused score.

### 7.3 Fused score and thresholds

```
fused_score = Σ (w_i × normalized_score_i)   for i in {audio, vibration, environment, gas, current}
```

| Threshold | Value | Confidence | Fires |
|---|---|---|---|
| Individual "elevated" (per-modality) | 0.75 | 🟡 | Used for corroboration counting (§7.4) |
| Fused alert threshold | 0.65 | 🟡 | Local LED/buzzer + remote alert |
| Fused response threshold | 0.85 | 🟡 | Actuation *candidate* — still gated by §7.4 + Firmware Spec's debounce/cooldown |

🟡 All three numbers are engineering defaults chosen to give real separation between "elevated" and "very elevated," avoiding a hair-trigger system — **all three are explicitly recalibrated from burn-in data per ADD §9.5**, not fixed forever. This spec's numbers are the pre-calibration starting point, not the final production values.

### 7.4 Actuation corroboration (2-of-5, resolves ADD §9.5's rule into exact logic)

```
actuation_candidate = (fused_score ≥ 0.85)
                       AND (count of modalities with normalized_score ≥ 0.75) ≥ 2
                       AND (current_modality boosted_score ≥ 0.75 in at least
                            one of those cases, OR two non-current modalities
                            both independently qualify)
```
This is still only a *candidate* — Firmware Spec (Phase B.2) adds the debounce/cooldown/boot-safe/override gates before this becomes a real actuation.

### 7.5 SW-420 hardware corroboration (added post-Phase-B, DEC-010)

The SW-420 mechanical vibration switch (ADD §7.3) is not a scored modality — it's a binary, firmware-independent hardware trigger. Its role here is a **diagnostic corroboration check**, not a gating input: it never blocks or enables an actuation candidate by itself, but it makes the vibration modality's contribution to any corroborated event independently auditable.

```
whenever vibration_modality is one of the ≥2 modalities satisfying §7.4's
corroboration count for a given actuation candidate:

    sw420_triggered = did SW-420's digital output register HIGH at any
                       point within the same debounce window (Firmware
                       Spec §3.2, ~4 seconds) as the vibration score
                       elevation?

    log hw_confirmed = sw420_triggered   (true | false)
```

**Why this doesn't gate the decision:** SW-420's own trigger threshold is a separate, cruder mechanical sensitivity than the MPU-6050's actual signal analysis — the two are expected to disagree sometimes even when both are working correctly. Making it a hard gate would let a cruder sensor override a more capable one. Instead, `hw_confirmed = false` on a vibration-corroborated event is logged as a flagged inconsistency for operator review, without silently trusting or silently overriding either sensor.

**Firmware-side implementation:** Firmware Spec §2 (resolves the polling/logging mechanism), Backend Spec's `anomaly_events.contributing_modalities` JSON gains an optional `"vibration_hw_confirmed": true|false` field when applicable — no new schema column needed.

## 8. Quantization-Aware Training (QAT) — procedure

🟢 Standard TFLite QAT workflow, exact steps:
```
1. Train the float32 model to convergence on Stage 1+2 data (§9).
2. Insert fake-quantization nodes (simulate INT8 rounding on the
   forward pass; keep float32 gradients on the backward pass).
3. Fine-tune for additional epochs (🟡 propose 10-20% of original
   training epochs) with fake-quant nodes active.
4. Convert to true INT8 via standard post-QAT TFLite conversion.
5. Re-evaluate on the held-out set (§9) — INT8 AUC must not degrade
   more than 2 percentage points vs. the float32 baseline. If it does,
   this is a Blocker Report (something is wrong with the quantization
   step, not a value to silently accept).
```

## 9. Held-out evaluation protocol

**Split methodology:** 🟢 stratified by data source, not randomly mixed — hold out 20% of each public dataset (ESC-50, UrbanSound8K, DCASE/MIMII) *separately*, so the held-out set reflects genuine cross-dataset generalization, not just within-dataset splitting. Synthetic anomaly-injected clips (ADD §10.3) are held out at the same 20% rate, kept separate from the normal-only training pool by construction (they were never in it).

**AUC bar:** 🟢 **0.85**, adopted directly from the MLPerf Tiny anomaly-detection benchmark's own established bar — a legitimate, citable reference point, not an arbitrary number.

**Stage 3 (burn-in) evaluation:** 🟡 hold out the final 2 days of the burn-in window from the fine-tuning fit; use those 2 days purely to confirm the calibrated model generalizes to genuinely unseen real-environment samples, not just samples it was calibrated on.

## 10. Burn-in duration — exact stopping rule (resolves the "1 vs 2 weeks" ambiguity)

🟡 Burn-in continues until **all** of the following are true:
```
1. ≥ 7 calendar days elapsed (covers a full weekly activity cycle)
2. MQ135's 24-48h conditioning window has completed (trivially true by day 7)
3. Per-modality rolling baseline (μ, σ) has "stabilized" for all 5 scored
   modalities (audio, vibration, environment, gas, current, per §6-7):
   the most recent 24h window's μ/σ differs from the prior 24h window's
   by < 10% (relative).
```
If not all conditions are met by day 7, continue up to the ADD's stated 14-day bound. **If still not stabilized by day 14, this is a Blocker Report, not a silent extension** — something about the deployment environment or the model itself needs investigation, not more waiting.

## 11. Data augmentation strategy (formalized post-Phase-B, DEC-010 — expands on ADD §10.3's brief mention)

Two different techniques for two genuinely different jobs, matching the boundary the project already established between "normal" and "anomaly" data — not one blanket "add synthetic data" approach.

**Normal class (Stage 1-2 training pool) — sophisticated augmentation of real recordings only, never generative synthesis:**
- 🟢 **SpecAugment** — time and frequency masking applied directly to the log-Mel spectrogram (the technique behind production speech-recognition systems, not a naive trick).
- 🟢 **Mixup** — blending pairs of real normal recordings at random ratios to produce realistic intermediate examples.
- 🟡 **Room-impulse-response (RIR) convolution** — convolving real recordings with a set of real or well-characterized RIR profiles to simulate acoustic variation across different real spaces, increasing robustness without inventing new "normal" content from nothing.

**Why not generative synthesis here:** even the most favorable published results for synthetic-heavy audio training still start from real seed recordings, and synthetic data shows a measurable, documented performance drop moving from synthetic training to real-world evaluation. Using generative synthesis for the normal class specifically would re-fabricate the exact gap the field-calibration burn-in (ADD §10.4) exists to close honestly — not a trade worth making for a "sounds more advanced" technique.

**Anomaly class — pretrained generative synthesis, conditioned on real seeds, is the right tool here specifically:**
- 🟡 Use a pretrained diffusion-based audio generation model, conditioned/prompted using real seed examples of anomaly-adjacent sounds (impacts, mechanical grinding, glass-breaking-class events pulled from ESC-50/DCASE), to synthesize diverse anomaly variations beyond naive noise injection.
- This stays inside the project's own already-validated boundary: real anomaly examples are scarce for everyone, so synthesizing more of them from real seeds is expected, credible practice — this was true before this addition, this just upgrades the *quality* of the technique used within that already-approved boundary.
- 🔴 **Verify VRAM fit before committing**: some full-size pretrained audio diffusion models may not fit comfortably in 4GB VRAM — confirm a specific model/checkpoint fits (or use a smaller/distilled variant) before building a training-pipeline dependency on it, rather than assuming.

**Training compute:** 🟡 primary compute switches to local GPU (confirmed available: RTX 3050, 4GB) rather than Google Colab as originally specified in ADD §10.2 — the IDNN's small size (~55K parameters, per §2) means compute was never actually the bottleneck Colab was solving for. This is a formal amendment to the ADD, not a silent change — see `specs/foundation/AMENDMENTS.md` AMENDMENT-002. Colab remains available as an occasional fallback (e.g., if local GPU is busy with the anomaly-generation model at the same time as IDNN training).

---

## Registry entries resolved by this document
#1 (alert threshold), #2 (response threshold), #3 (per-modality thresholds), #7 (cold-start weights), #8 (spectrogram params), #9 (IDNN context window), #10 (AUC bar), #11 (split methodology), #12 (vibration bands), #13 (ACS712 filter), #14 (MQ135 formula — algorithm resolved, constants deferred to real datasheet/burn-in data by design), #15 (burn-in duration rule).

**Also closed during a post-completion quality audit (not a registry item, since it was never identified as a gap in Phase A — a genuine miss, not a deferred item): environment (DHT22+BMP280) never had a defined scoring algorithm, despite the ADD's own overview committing to 5 scored modalities. §6 closes this. This is exactly the class of finding a dedicated audit exists to catch — logged as `DEC-017`.**

**12 of 26 registry entries resolved. Remaining 14 belong to Firmware, Backend, and Local MLOps specs (Phase B.2-B.4).**
