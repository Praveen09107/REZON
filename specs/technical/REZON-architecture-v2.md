# REZON — Architecture v2
**Final hardware-grounded redesign: 4-modality sensing + autonomous actuation**

> Supersedes the earlier master spec. Same name, same generic "intelligent space anomaly monitoring" framing, same solo/₹-budget/$0-cloud constraints — this version reflects the hardware you actually finalized and the two capabilities added since: a 4th sensing modality (gas/air-quality) and a closed-loop actuation layer (relay).

---

## 1. What changed, and why it's a real upgrade, not scope creep

| Before | Now | Why |
|---|---|---|
| 3 modalities (audio, vibration, environment) | **4 modalities** — added gas/air-quality (MQ135) | MQ135 does double duty: continuous air-quality trend (Pillar A) *and* early hazard signal for gas leaks/smoke (Pillar B) — genuinely different failure class than audio/vibration can catch |
| Detect + alert only | **Detect, alert, and respond** — relay module added | The system can now autonomously cut power to a monitored load on a confirmed anomaly, not just report it. This is a real capability tier change, not a sensor add-on |
| DHT22 as passive context | **DHT22 actively compensates MQ135's reading** | Gas sensors drift with temperature/humidity (documented in MQ-series datasheets) — DHT22 becomes an active correction input, not just another dashboard number |
| BME280 (single chip) | **DHT22 (owned) + BMP280 (pressure-only)** | Reuses owned hardware, recovers the pressure feature at near-zero marginal cost |

---

## 2. Final hardware (as bought)

| Component | Role |
|---|---|
| ESP32-S3-WROOM-1 N16R8 (16MB Flash + 8MB PSRAM) | Compute |
| INMP441 | Audio modality |
| MPU-6050 (GY-521) | Vibration modality |
| SW-420 (owned) | Optional secondary hard-trigger vibration switch, parallel to MPU-6050 |
| DHT22 (owned) | Temperature + humidity — environmental modality + gas-sensor compensation input |
| BMP280 | Pressure — completes the environmental modality |
| MQ135 | Gas/air-quality modality |
| 5V single-channel relay (Songle optocoupler) | **New — actuation** |
| RGB LED + active buzzer (owned) | Local output |
| MicroSD module or onboard slot | Local buffering + OTA staging |
| AMS1117 3.3V (owned) | Power rail |

---

## 3. The sensing + response architecture — five functional roles, not three

Rethink this as five roles instead of "sensors + cloud":

| Role | Component(s) | Function |
|---|---|---|
| **Acoustic sensing** | INMP441 | Primary anomaly signal — autoencoder reconstruction error |
| **Motion sensing** | MPU-6050 (+SW-420 as hard trigger) | Secondary anomaly signal — statistical/Z-score monitor |
| **Environmental context + compensation** | DHT22 + BMP280 | Feeds baseline context AND actively corrects the gas sensor's drift |
| **Gas/air-quality sensing** | MQ135 | Continuous trend (Pillar A) + hazard flag (Pillar B) — the newest modality |
| **Actuation** | Relay | Converts a fused anomaly decision into a physical action |

This is the real structural change from v1: the environmental modality is no longer just "another input to the fusion score" — it has a second job (compensating another sensor), and there's now an output role that didn't exist before.

---

## 4. On-device AI — updated fusion logic

**Per-modality scoring (unchanged from the redesigned research, still the right approach):**
- **Audio:** depthwise-separable convolutional autoencoder on log-Mel spectrograms, INT8-quantized, trained only on normal sound. Score = reconstruction error.
- **Motion:** rolling Z-score / statistical outlier check on RMS, peak-to-peak, and basic frequency-band energy from the IMU.

**New — gas/air-quality scoring, with compensation:**
1. Read raw MQ135 analog value (via the voltage divider — see hardware notes).
2. Read DHT22 temperature + humidity.
3. Apply a compensation correction to the raw MQ135 reading using temp/humidity (a simple lookup-table or linear-correction approach is sufficient — this doesn't need to be a trained model, it's a documented sensor-physics correction).
4. Compare the corrected reading against a rolling baseline (same adaptive-threshold philosophy as the other two modalities) to produce a gas anomaly score.

**Fusion (updated — three scores now, not two):**
```
fused_score = w1 * audio_reconstruction_error
            + w2 * motion_zscore
            + w3 * gas_anomaly_score
```
Each term normalized against its own rolling baseline before weighting, same adaptive-threshold approach as before — no fixed hand-tuned global threshold.

**New — actuation trigger logic:**
```
if fused_score > alert_threshold:
    → LED red, buzzer on, MQTT anomaly/alert published (QoS 1)
if fused_score > response_threshold (higher bar than alert_threshold):
    → relay fires (cuts power to the monitored load)
    → MQTT anomaly/response published (QoS 1, logs the autonomous action taken)
```
Using a **higher bar for actuation than for alerting** is a deliberate, defensible design choice: a false alert costs you a notification; a false actuation costs you cutting power to something. Two thresholds, not one, is the right way to build this.

---

## 5. Firmware task architecture — updated RTOS split

Same five-task philosophy as before, with the new sensor and the actuation logic slotted in:

```
Core 0, high priority:  Sensor Acquisition Task
  - I2S DMA (audio) — time-critical, cannot tolerate jitter
  - I2C polling (MPU-6050, BMP280)
  - GPIO digital read (SW-420, if used)
  - ADC read (MQ135 via voltage divider) — lower rate, ~once/sec is enough
  - Single-wire read (DHT22) — slow protocol, isolate its occasional
    read failures here so they never block audio sampling

Core 0, medium priority: Feature Extraction Task
  - FFT/mel-spectrogram (audio)
  - RMS/kurtosis/spectral features (IMU)
  - Gas-sensor compensation correction (uses DHT22 values)

Core 1, medium-high priority: Inference + Fusion Task
  - Autoencoder inference (audio)
  - Z-score check (motion)
  - Gas anomaly scoring (compensated MQ135 reading)
  - Fusion → alert_threshold / response_threshold decision

Core 1, low-medium priority: Networking Task
  - MQTT/TLS publish (telemetry, alerts, actuation events)
  - OTA client (subscribe, download, verify, dry-run, swap)

Core 1, low priority: Local Output + Actuation Task
  - LED (RMT) + buzzer (PWM)
  - Relay GPIO control — deliberately kept on the LOWEST-priority
    task alongside LED/buzzer, not the inference task, so a relay
    GPIO write never has a chance to delay time-critical sampling
```

**Why the relay sits on the output task, not inference:** actuation is a *consequence* of a decision already made, not part of making the decision. Keeping it physically separate in code (and in RTOS priority) from the inference task is good practice — it means a slow or stuck relay write can never back up and delay your audio sampling loop.

---

## 6. MQTT topic structure — updated

```
rezon/{device_id}/
├── telemetry/audio_features
├── telemetry/imu_features
├── telemetry/env                    (DHT22 + BMP280 raw)
├── telemetry/gas                    (MQ135 raw + compensated value)
├── anomaly/alert                    (QoS 1)
├── anomaly/response                 (QoS 1 — NEW: logs an autonomous relay action)
├── status/heartbeat
├── ota/notify  |  ota/ack
└── config/update
```

The new `anomaly/response` topic matters for your report: it means every autonomous action the device takes is independently logged and auditable in the cloud — you can always answer "why did it do that" by looking at the fused score and individual modality readings at that timestamp.

---

## 7. Cloud pipeline — same six services, updated schema

No new cloud infrastructure needed — the existing solo-scoped stack (Mosquitto → FastAPI → TimescaleDB → Evidently → Prefect → MLflow → Grafana) absorbs the new modality and the actuation log as additional columns/tables, not new services:

- `telemetry` table gains `gas_raw`, `gas_compensated`, `gas_anomaly_score` columns.
- A new `actuation_events` table logs every relay trigger: timestamp, fused_score at time of trigger, which modality scores contributed most, and outcome.
- Grafana gains one more panel: an actuation event log, alongside the existing anomaly timeline.
- Evidently's drift check now also monitors the gas modality's distribution over time, same as it already does for audio/motion.

---

## 8. End-to-end data flow (updated narrative for your report)

1. Four sensors sample continuously: audio (I2S DMA), vibration (I2C), environment (I2C + single-wire), gas (ADC).
2. Environmental readings actively compensate the gas sensor's raw output before it's used for anything else.
3. Three independent anomaly scores (audio, motion, gas) are computed and fused into one adaptive-threshold decision.
4. If the fused score crosses the **alert threshold**: local LED/buzzer fire, an alert is published over MQTT/TLS.
5. If the fused score crosses the higher **response threshold**: the relay autonomously actuates, and that action is independently logged.
6. Regardless of anomaly status, lightweight telemetry (never raw audio) streams continuously to the cloud.
7. The cloud stores, visualizes, and periodically checks all four modalities for drift; if drift crosses its own threshold, retraining triggers automatically, validates, and registers a new model.
8. A validated new model is pushed to the device via checksum-verified, dry-run-tested, rollback-safe OTA.

This is the same closed-loop story as before — detect → confirm → retrain → redeploy — now with a second closed loop layered on top: **detect → decide → act**, independently logged and auditable.
