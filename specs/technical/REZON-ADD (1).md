# REZON — Architecture Design Document (ADD)

**Document type:** Architecture Design Document
**System:** REZON — privacy-preserving, multimodal edge-AI anomaly monitoring platform
**Status:** Design-frozen · Approved for implementation
**Audience:** Implementing engineer(s), reviewers, project evaluators

---

## 1. Document Control, Purpose, Scope & Audience

### 1.1 Purpose
This document is the canonical, authoritative architecture reference for REZON. It consolidates every finalized architectural decision, refinement, critical-review finding, and audit conclusion reached during design into a single source of truth. It is written to be handed to an implementing engineer before development begins and to remain the definitive reference throughout the implementation lifecycle. Where a decision was contested during review, the reasoning — including the losing alternative — is preserved so that no decision has to be re-litigated from memory.

### 1.2 Purpose of the system
REZON monitors a physical space and the one machine within it that REZON can control, learns what "normal" looks like for that specific environment, detects deviations from that normal in real time across five independent sensing modalities, and can autonomously respond by cutting power to the monitored machine — all while never transmitting privacy-sensitive raw data (such as audio) off the device. A cloud tier serves a polished multi-user product experience and always-on ingestion; a local tier performs the heavy AI lifecycle work (historical analysis, drift detection, retraining) and publishes improved models back to the device over the air.

### 1.3 Scope
In scope: the complete end-to-end system — edge hardware, firmware, on-device AI, the training pipeline, device-to-cloud communication, the cloud backend, the local MLOps tier, data and storage, security, the frontend product, observability, and all runtime workflows.

Out of scope for this document (see §24 for the full list and rationale): the week-by-week implementation/build sequence (a separate deliverable), implementation code, and any capability explicitly deferred as future production hardening.

### 1.4 Audience
The primary reader is the solo implementing engineer. The document also serves reviewers and evaluators who need to understand not just *what* was built but *why each decision is the strongest practical choice for this system at its actual scale.*

---

## 2. Glossary & Conventions

| Term | Meaning |
|---|---|
| **Modality** | One independent sensing channel (audio, vibration, environment, gas, current) with its own feature extraction and anomaly-scoring logic. |
| **IDNN** | Interpolation Deep Neural Network — the on-device audio model; predicts a masked center spectrogram frame from surrounding context and scores by prediction error. |
| **Autoencoder (AE)** | The baseline audio model IDNN is benchmarked against; reconstructs its full input and scores by reconstruction error. |
| **QAT** | Quantization-Aware Training — training that simulates INT8 precision loss so the model learns weights robust to quantization. |
| **Fused score** | The single combined anomaly value produced from the five per-modality scores. |
| **Alert threshold** | The lower decision bar; crossing it produces local + remote alerts. |
| **Response threshold** | The higher decision bar; crossing it (with corroboration and safety gating) triggers actuation. |
| **Corroboration (2-of-N)** | The requirement that at least two modalities independently exceed their own thresholds before actuation is permitted. |
| **Field-calibration burn-in** | The initial post-deployment period during which the device runs in logging-only mode to collect real local data and calibrate the model to its actual environment. |
| **Actuation** | The physical act of the device tripping its relay to cut power to the monitored machine. |
| **OTA** | Over-the-air model/firmware update. |
| **Edge tier** | The ESP32-S3 device. |
| **Cloud tier** | The always-on Supabase-hosted ingestion + product-serving layer. |
| **Local tier** | The operator's machine running the heavy AI/MLOps stack. |
| **Idempotency key** | A monotonic per-device sequence number allowing the server to de-duplicate retried submissions. |

### 2.1 Conventions
"Must" denotes a mandatory architectural property. "Should" denotes a strong recommendation with acceptable, documented exceptions. All references to "the device" mean the single ESP32-S3 unit. All references to "$0" mean no recurring cash cost using permanent free tiers, not trial credits.

---

## 3. Assumptions & Constraints

### 3.1 Assumptions
- The system operates as a **single physical device** monitoring a single space and a single machine. Fleet operation is explicitly not assumed (though the evolution path is documented in §21).
- The implementing party is **solo**, with a bounded (~4-month) timeline.
- The monitored machine is a **real low-voltage/DC load** (a motor, fan, or appliance) suitable for safe relay switching in a demonstration context. Mains-AC switching is out of scope.
- **Large volumes of real, pre-collected training data from the actual deployment space are not available.** This assumption is load-bearing: it shapes the entire AI and training design.
- The operator's local machine is **not guaranteed always-on**; it runs on the operator's schedule.
- Wi-Fi connectivity at the deployment site is available but **may be intermittent or restricted** (e.g., institutional networks blocking non-standard ports).

### 3.2 Constraints
- **Hardware is fixed** (procured). The bill of materials in §7 is not open for reconsideration.
- **Cloud cost must be $0 recurring**, on permanent free tiers.
- **No dependency on any single unreliable always-on host** (this constraint arose directly from Oracle Cloud Always Free proving unreliable — see decision log D-14).
- The public product surface must support **real authentication and roles** (it must present as a genuine multi-user product), while operator/admin tooling must remain private.
- On-device compute is bounded by the ESP32-S3's resources; models must fit and run within that envelope.

---

## 4. Non-Functional Requirements (NFRs)

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Privacy | Raw audio (and any raw high-fidelity sensor stream capable of reconstructing private content) must never leave the device. Only features and scores are transmitted. |
| NFR-2 | Availability (edge) | The device must continue to detect and locally respond to anomalies with no dependency on cloud or network availability. |
| NFR-3 | Availability (product) | The public product surface and cloud ingestion must be always-on, independent of the operator's local machine. |
| NFR-4 | Latency (detection→local response) | Local alert/actuation must occur in near-real-time (single-digit seconds from a sustained anomaly), unaffected by network latency. |
| NFR-5 | Safety | The one physically consequential action (actuation) must be governed by corroboration, temporal debounce, rate-limiting, a boot-safe default, full attempt logging, and a firmware-independent physical override. |
| NFR-6 | Cost | No recurring cash cost; all services on permanent free tiers. |
| NFR-7 | Data integrity | Telemetry ingestion must be resilient to duplicate submissions caused by network retries (idempotent). |
| NFR-8 | Durability | Recent telemetry must be recoverable across at least the loss of any single storage location. |
| NFR-9 | Maintainability | The system must be operable and evolvable by a single person; component count and operational surface are minimized deliberately. |
| NFR-10 | Security | All transport encrypted; per-device identity enforced; admin tooling not publicly exposed; OTA integrity-verified with rollback. |
| NFR-11 | Model trustworthiness | The on-device audio model must be calibrated to the real deployment environment before its alerts/actuations are trusted. |
| NFR-12 | Observability | The operator must be able to determine, at any time, device health, model state, drift status, and the full reasoning behind any alert or actuation. |

---

## 5. System Context & Overview

### 5.1 System context
REZON consists of three tiers with distinct, permanent responsibilities:

- **Edge tier (the device):** senses, extracts features, runs inference, fuses scores, decides, alerts, and actuates. Fully autonomous for detection and response.
- **Cloud tier (Supabase + Vercel):** always-on. Ingests device telemetry over HTTPS, stores recent data and metadata, authenticates users, serves model files for OTA, and hosts the public product web application.
- **Local tier (operator's machine, Dockerized):** on-schedule. Holds full historical data, runs drift detection and retraining, versions models, hosts operator dashboards, and publishes improved models to the cloud for OTA delivery. Reachable by the operator only over a private mesh network.

### 5.2 One-paragraph end-to-end overview
Five sensors observe the space and the monitored machine. The ESP32-S3 samples them under a real-time OS, converts raw signals to features, and scores each modality for abnormality — audio via a small neural network, the other four via self-calibrating statistical monitors. The five scores fuse into one decision. A lower threshold raises local and remote alerts; a higher threshold, gated by multi-modality corroboration and safety logic, trips a relay that cuts power to the machine. Regardless of anomaly state, the device transmits only anonymized features and scores over authenticated, idempotent HTTPS to the cloud, which stores them and serves a public product where users see live status, review incidents, analyze history, and manage the device. The operator's local machine pulls that history into a full analytics environment, watches for drift in what "normal" means, retrains the audio model when drift is detected, validates and versions it, and publishes it back for the device to adopt through a safe, rollback-protected OTA process. The result is a closed loop from raw sensing to autonomous self-updating, with the device never dependent on the cloud to keep working.

---

## 6. Architecture Principles

These principles are the "why" beneath the specific decisions; every section that follows can be traced back to one or more.

**P1 — Thin, smart edge.** Time-critical and privacy-sensitive work (sensing, feature extraction, inference, immediate response) happens on the device and never depends on the cloud. This is what delivers NFR-1, NFR-2, and NFR-4 simultaneously.

**P2 — Honest tiering.** The cloud and local tiers have genuinely different uptime and compute profiles, so each owns the jobs that fit its profile: the cloud is always-on but light; the local tier is heavy but periodic. Neither is a degraded stand-in for the other.

**P3 — Right-sizing over impressiveness.** Every component must earn its place at *this system's actual scale* (one device, one operator, one machine). Where a conventional "textbook IoT" component solved a problem REZON does not have, it was removed (a message broker) or replaced with something simpler (a scheduled script instead of a workflow orchestrator).

**P4 — The right model for each signal, not uniformity.** Audio is complex and non-stationary and earns a neural network; vibration, gas, and current are simpler and well-behaved and earn transparent statistical monitors. This heterogeneity is deliberate and, as §9 explains, is what dissolves the training-data constraint for four of five modalities.

**P5 — Safety proportional to consequence.** The single action with physical consequences (actuation) receives layered safeguards that alerting does not, up to and including a hardware override independent of the firmware that decides.

**P6 — Calibrate to reality before trust.** A model trained on public data is a starting point, not a finished product; it must be calibrated to the real deployment environment before its decisions are trusted.

**P7 — Preserve the reasoning.** Every alert and actuation must be explainable after the fact from stored per-modality evidence. The system is never a black box to its operator.

---

## 7. Hardware Architecture

### 7.1 Overview and rationale
The hardware is a fixed, procured set. This section documents each component's role, why it was selected, how it interfaces with the compute core, and the electrical considerations that the firmware and safety design depend on.

### 7.2 Compute core — ESP32-S3-WROOM-1 (N16R8)
A dual-core Xtensa LX7 processor at 240 MHz, with 16 MB of flash and 8 MB of PSRAM, integrated Wi-Fi and Bluetooth LE, and ESP-NN vector instructions that accelerate quantized neural-network inference.

Three properties of this chip are load-bearing:
- **8 MB PSRAM** provides the working memory (tensor arena) the on-device neural network needs, which the chip's small internal SRAM cannot spare alongside the Wi-Fi stack. Without PSRAM, the audio model would not fit. This is the single most important hardware reason this specific chip is used.
- **Dual cores** allow the firmware to physically isolate time-critical sensing from all other work (see §8), guaranteeing that audio sampling is never delayed by inference, networking, or actuation.
- **16 MB flash** comfortably holds two complete firmware+model images at once, which is the precondition for safe dual-partition OTA rollback (§12).

Alternatives considered and rejected: more powerful MCUs with dedicated neural accelerators (e.g., an NPU-equipped part) or ultra-low-power dedicated audio-AI silicon would improve raw inference performance or power draw, but were rejected for tooling friction, lack of integrated Wi-Fi (which the closed OTA loop depends on), and smaller community support — all of which matter more than peak performance for a solo build. The chip is mains-powered, so power draw is not a binding constraint, which further neutralizes the dedicated-low-power-silicon advantage.

### 7.3 Sensing modalities
Five sensors provide five independent perceptual channels. The design intent is that **no single modality can drive a consequential action alone** (see corroboration, §9 and §11).

**Audio — INMP441 (I2S digital MEMS microphone).** The primary anomaly channel; sound carries the earliest and richest evidence of most abnormal events. Digital I2S output means the audio is captured directly by the chip's I2S peripheral via DMA, with no analog front-end noise. It is the only modality whose *raw* signal is privacy-sensitive, which is precisely why raw audio never leaves the device (NFR-1).

**Vibration — MPU-6050 (6-axis IMU over I2C), with SW-420 as a secondary hard-trigger.** Captures mechanical anomalies (imbalance, impacts, looseness). The MPU-6050 provides rich accelerometer/gyroscope data over I2C; the SW-420 is a cheap mechanical switch providing a firmware-independent "something physically shook" digital trigger that backs up the richer signal.

**Environment — DHT22 (temperature + humidity, single-wire) and BMP280 (pressure, I2C).** Provides contextual environmental features, and — critically — the temperature and humidity readings are used to **compensate the gas sensor** (see below), giving these sensors an active analytical role rather than a passive one. DHT22's single-wire protocol is comparatively slow and occasionally returns failed reads; the firmware isolates its reads so a failure never stalls other sensing.

**Gas / air quality — MQ135 (analog, via a resistor voltage divider into an ADC pin).** Provides both a continuous air-quality trend (Pillar A) and a smoke/gas hazard signal (Pillar B). Two electrical/operational facts are architecturally significant:
- Its analog output can swing near 5 V, but the ESP32-S3 ADC pins tolerate a maximum of 3.3 V. A **resistor voltage divider** (built from the owned resistor kit) sits on the analog output line to bring the signal into the safe range. Connecting the raw output directly would risk permanent damage to the ADC pin. This divider is a mandatory part of the hardware wiring.
- MOS gas sensors of this type require a **24–48 hour initial conditioning (burn-in) period** before their baseline stabilizes, and drift with temperature and humidity over their operating life. The temperature/humidity compensation addresses the drift; the conditioning period is folded into the field-calibration burn-in window (§10) at no additional time cost.

**Current — ACS712 (5 A Hall-effect current sensor, analog into an ADC pin).** This is the fifth modality and it is distinct in kind from the other four: every other sensor perceives the *environment*, while the current sensor perceives the *machine the relay controls* — the actuation target itself. This closes a real perceptual gap: overcurrent is a direct precursor to mechanical binding, shorts, and electrical fire; current dropping unexpectedly to near-zero means the machine disconnected or failed — a condition no environmental sensor can detect. Because the current sensor is the only channel that observes the exact device REZON can act on, it is weighted toward the actuation decision (§9.5).
- Electrical/operational fact of architectural significance: the ACS712 5 A variant has a **high noise floor** (raw readings are unusable for detecting small current changes without conditioning). The firmware **must** apply moving-average plus alpha (exponential) filtering to the current signal before it is scored; without this, the fifth modality would contribute noise rather than signal, undermining the exact justification for including it. This filtering is a mandatory feature-extraction step, not an optional refinement.

### 7.4 Actuation and local output
- **5 V single-channel relay (optocoupler-isolated, Songle-branded relay component).** The actuator: an electrically isolated switch the device trips to cut power to the monitored machine. The optocoupler isolation protects the low-voltage control side from the switched load; the branded relay component was chosen for reliable switching contacts, because this is the only component performing a consequential physical action.
- **Physical manual override switch (in series with the relay).** A firmware-independent switch physically in series with the relay's switched line. This exists because a software-only safety system has a categorical gap: it cannot protect against the case where the firmware *itself* is the fault (a bad model post-OTA, an unanticipated corroboration edge case). The physical override lets a human force the safe state regardless of what the firmware believes. This is mandatory (NFR-5).
- **RGB LED** — at-a-glance local status (normal/elevated/anomalous).
- **Active buzzer** — immediate audible local alert, requiring no network round-trip.

### 7.5 Storage and power
- **MicroSD** — serves three roles: buffering recent raw audio locally (for optional post-hoc review without ever transmitting it), staging OTA downloads safely before they are applied, and acting as a retry buffer and a third copy of recent telemetry (see §12 and §15).
- **AMS1117 3.3 V regulator** — provides a clean 3.3 V sensor power rail.
- Supporting passives (resistor kit including the MQ135 divider and I2C pull-ups, breadboard, wiring) and a spare classic ESP-WROOM-32 retained for isolated early wiring tests.

### 7.6 Interface allocation summary
The device's peripherals are allocated across the chip's interfaces as follows: I2S (audio), I2C shared bus (MPU-6050 + BMP280, with pull-ups), single-wire (DHT22), two ADC channels (MQ135 via divider, ACS712 via filter), SPI (microSD), and GPIO (SW-420 trigger, relay control, LED, buzzer, manual-override sensing). The ESP32-S3's GPIO count accommodates this allocation with margin. A concrete pin-mapping table is the first artifact the implementation should produce.

---

## 8. Edge Firmware Architecture

### 8.1 Design driver
The firmware's central architectural decision is how work is distributed across the two cores, and the driver is singular: **audio sampling integrity must never be compromised.** Audio is sampled continuously at a fixed rate; any delay corrupts the buffer and invalidates every downstream feature and inference for that window. The design therefore guarantees, structurally, that sampling is never preempted by lower-value work.

### 8.2 Real-time operating system
The firmware runs on FreeRTOS. Work is decomposed into prioritized tasks pinned to specific cores. The two-core split is not stylistic — it is the mechanism that satisfies NFR-4 (real-time local response) while guaranteeing sampling integrity.

### 8.3 Task architecture

**Core 0 — dedicated to sensing, protected from all other work.**
- *Sensor Acquisition Task (highest priority).* Drives audio capture via the I2S peripheral in DMA mode (hardware-paced, minimal CPU involvement), and polls the other sensors at their appropriate individual rates — vibration fast, environment slow, gas and current at moderate rates. DHT22's occasionally-failing single-wire reads are isolated here so a failed read degrades gracefully and never stalls the pipeline.
- *Feature Extraction Task (medium priority).* Transforms raw audio into a log-Mel spectrogram; computes statistical and spectral-band features for vibration (see §9.3 — this includes frequency-band energies, not merely time-domain amplitude); applies the mandatory moving-average + alpha filter to the current signal; and performs the gas-sensor temperature/humidity compensation. The output of this task is a set of clean, per-modality feature vectors ready for scoring.

**Core 1 — inference, communication, and action.**
- *Inference & Fusion Task (medium-high priority).* Runs the audio neural network, computes the statistical anomaly scores for the other four modalities, normalizes each against its rolling baseline, fuses them, and evaluates the alert and response thresholds together with the corroboration and safety gating.
- *Networking Task (low-medium priority).* Performs authenticated, idempotent HTTPS submission of telemetry and the OTA client duties (checking for, downloading, verifying, and staging new models). Network latency is tolerable, so this task yields to inference.
- *Local Output & Actuation Task (low priority).* Drives the LED, buzzer, and — through the safety-governed actuation logic — the relay. This task is deliberately the lowest priority and is separated from the inference task so that a slow relay or output operation can never back-pressure the decision-making or (transitively) the sensing.

### 8.4 Why this separation is correct
Placing actuation on the lowest-priority output task, distinct from the task that *decides* to actuate, embodies principle P5 and a broader safety pattern: the layer that performs a physical action should be structurally subordinate to, and separate from, the layer that reasons about whether to act — so that reasoning is never delayed by action, and action is a clean consequence of a completed decision. Combined with the boot-safe default (the firmware forces the relay to its safe state on power-up and reconnect before doing anything else) and the physical override (§7.4), the device has defense in depth around its one consequential action.

---

## 9. AI / ML Architecture

This is the technical heart of REZON and the most detailed section. The governing principle is P4: **the right model for each signal, not a single model for uniformity.** This section explains the per-modality scoring, why each approach was chosen over its alternatives, how the scores are fused, and how the fusion feeds the two-threshold decision.

### 9.1 The central design insight
Three of the five modalities (vibration, gas, current) use **self-calibrating statistical monitors that require no pre-training.** Only the audio modality uses a trained neural network. This heterogeneity is not incidental — it is the architectural answer to the binding assumption (§3.1) that real pre-collected training data from the deployment space is unavailable. Because the statistical monitors learn their baselines live, from whatever the device actually observes once deployed, they sidestep the training-data problem entirely for four of five modalities. Only audio, whose complexity genuinely warrants a neural network, carries a training-data dependency — and that dependency is managed by the three-stage pipeline in §10. A unified single-model design (considered and rejected — see §23, D-07) would have reintroduced the training-data problem across all modalities; the heterogeneous design dissolves it.

### 9.2 Audio modality — Interpolation Deep Neural Network (IDNN)
**What it does.** The audio model operates on log-Mel spectrogram windows. Rather than reconstructing an entire input window (as a plain autoencoder does), the IDNN removes the center frame of the window and predicts what that missing frame should be from the surrounding context frames. The anomaly score is the prediction error: when the incoming sound resembles learned-normal audio, the center frame is predicted accurately (low score); when it doesn't, prediction degrades (high score).

**Why IDNN over a plain autoencoder.** Published results indicate IDNN outperforms plain reconstruction autoencoders specifically on **non-stationary** sound. A generic monitored space — with intermittent activity, voices, doors, variable background — is more non-stationary than the steady industrial hums on which plain autoencoders and IDNNs perform comparably. IDNN is the same small size class as an autoencoder, so it carries no additional on-device cost; the only added cost is modest training-pipeline complexity, paid once.

**Important honesty (framed as a validated hypothesis, not a settled fact).** The IDNN advantage was demonstrated most strongly on specific machine types in the source literature, not proven universal. REZON therefore treats "IDNN beats a plain autoencoder on our audio" as a **hypothesis to validate empirically** on the held-out evaluation set (§10), with a plain autoencoder retained as the A/B baseline. If IDNN does not clearly win on REZON's actual data, the plain autoencoder is the fallback and the added complexity is dropped — consistent with principle P3.

**Training paradigm.** The model is trained **only on normal audio** (no anomaly labels), which matches the field-standard unsupervised framing for acoustic anomaly detection and means the system never requires examples of every possible failure — an impossible bar in practice.

**Quantization.** The model is quantized to INT8 for on-device execution, using **Quantization-Aware Training (QAT)** rather than post-training quantization. Because the anomaly decision hinges on a small error value compared against a threshold, preserving numerical precision through quantization directly protects detection sensitivity; QAT, by simulating quantization during training, yields weights robust to that precision loss.

### 9.3 Vibration modality — statistical monitor with spectral-band features
**What it does.** Maintains a live rolling baseline of the monitored machine's normal vibration and scores new readings by their deviation (a Z-score-style measure).

**Critical refinement — spectral-band features, not raw amplitude alone.** A naive Z-score on raw time-domain amplitude (RMS) has a well-documented blind spot: mechanical faults such as bearing wear, imbalance, and looseness often manifest as a **redistribution of energy across specific frequency bands** without necessarily changing overall amplitude. Scoring on amplitude alone would miss exactly these faults. The vibration scorer therefore computes energy in **2–3 frequency bands** (via the FFT-adjacent work already performed in feature extraction) and applies the deviation scoring across those band features. This closes a genuine detection gap at nearly zero additional cost, and does so without a neural network — consistent with P4 (this signal is well-behaved enough for a statistical approach; it just needs the *right* features).

### 9.4 Gas and current modalities — compensated / filtered statistical monitors
**Gas.** The MQ135 raw reading is first compensated using DHT22 temperature and humidity (correcting the known MOS-sensor drift), then scored against a rolling adaptive baseline. The compensation is a documented sensor-physics correction, not a learned model. This modality serves both pillars: its baseline trend is continuously useful (Pillar A), and sharp excursions flag hazards (Pillar B).

**Current.** The ACS712 raw reading is first passed through the mandatory moving-average + alpha filter (§7.3) to bring it above its noise floor, then scored against a rolling baseline that captures the monitored machine's normal electrical envelope. Both overcurrent excursions and unexpected drops toward zero are anomalous.

### 9.5 Fusion — from five scores to one decision
The five per-modality scores, each normalized against its own rolling baseline, are combined into a single fused score. Fusion is not a naive sum, because a naive sum has two failure modes: several mildly-elevated-but-individually-harmless scores could sum into a false alarm, and one genuinely alarming modality could be diluted by four calm ones.

Two mechanisms address this:
- **Weighting.** Scores are combined with weights reflecting each modality's reliability and relevance. The **current modality is weighted toward the actuation decision specifically**, because it is the only channel that observes the actuation target directly and can corroborate "this machine genuinely needs to be shut down" with evidence the environmental modalities cannot provide.
- **Corroboration (2-of-N).** Actuation is permitted only when **at least two modalities independently exceed their own thresholds** — not merely when the weighted sum is high. This mirrors real safety-critical sensor-fusion practice (require independent corroborating evidence before a high-consequence action). Alerting, by contrast, may fire on a single strong modality, because a false alert costs only a notification.

**Weight calibration.** The fusion weights and per-modality thresholds are **calibrated from the field-calibration burn-in data (§10)**, not hand-tuned as fixed constants chosen a priori. Tying weight calibration to the burn-in — which already exists in the pipeline — closes the "hidden hand-tuned fragility" gap at no additional cost and grounds the weights in the device's real environment.

### 9.6 The two-threshold decision
- **Alert threshold (lower).** Crossing it turns the LED red, sounds the buzzer, and emits a remote alert. Single-modality-triggerable; low cost if wrong.
- **Response threshold (higher).** Crossing it makes actuation a *candidate*, subject to the corroboration requirement and the full safety gating in §11. Two distinct bars exist because alerting and acting have fundamentally different costs of being wrong.

### 9.7 Explainability
Because fusion computes and the system stores each modality's contribution to every decision, every alert and actuation is explainable after the fact ("triggered primarily by gas and current, each above threshold, sustained for N seconds"). This satisfies P7 and directly feeds the frontend's alert-explainability feature (§17) and the operator's ability to tune and trust the system.

---

## 10. Training Pipeline Architecture

### 10.1 Design driver
REZON confronts its binding data constraint (§3.1) honestly: real, pre-collected "normal" data from the actual deployment space is unavailable. Four of five modalities avoid the problem entirely through self-calibrating statistical scoring (§9.1). Only the audio IDNN needs training data, and it is served by a deliberate three-stage pipeline that ends with calibration to the real environment.

### 10.2 Stage 1 — Public-data pretraining
The audio model is pretrained on public datasets, **weighted toward general ambient/environmental sound** (because a generic monitored space resembles ambient audio more than it resembles any single industrial machine), with industrial machine-condition datasets used **secondarily** — valued more for their proven normal-only training methodology and evaluation protocols than as literal representations of the target space. Training runs on free, session-based GPU compute (Google Colab), which is a distinct resource from the always-on hosting question and therefore immune to any hosting-capacity problem.

### 10.3 Stage 2 — Augmentation and synthetic anomalies
Real recordings are augmented (pitch, time, and noise variation) to broaden robustness — standard, expected practice. For the anomaly class specifically, **synthetic fault-like signatures are injected**, because real anomaly examples are scarce for everyone, not merely for a solo student, and synthetic anomaly injection is accepted practice even in professional pipelines. Synthetic data is deliberately **not** used to fabricate the normal baseline of the actual deployment space — even the best synthetic data is an imperfect stand-in for a real environment's true ambient signature. That job belongs exclusively to Stage 3.

### 10.4 Stage 3 — Field-calibration burn-in (the linchpin)
This stage is what makes a model trained on other environments trustworthy in the specific deployment space, satisfying NFR-11 and principle P6.

On first deployment, the device runs in **logging-only mode**: the full pipeline computes scores exactly as in production, but **alerts are suppressed and actuation is disabled**, while genuine local telemetry streams to the cloud. This period runs for one to two weeks and **absorbs the MQ135 24–48 hour sensor-conditioning requirement (§7.3) at no additional time cost** — the gas sensor conditions itself within the same window.

At the end of the window, a single fine-tuning pass — using the same retraining pipeline built for long-term drift (§14) — calibrates the audio model to the real space, and the fusion weights and thresholds are calibrated from the collected data (§9.5). Only after this calibration completes does the device **graduate** to full alert and actuation mode. This converts the data-access constraint from an unaddressed risk into a designed, budgeted milestone.

### 10.5 Evaluation discipline
Model quality is measured on a **genuinely held-out data split** — conditions the model never saw during training — mirroring how domain-generalization is evaluated in the field. This held-out evaluation is also where the IDNN-vs-autoencoder A/B (§9.2) is decided. A reported accuracy figure is only trusted if it comes from this held-out evaluation, never from training performance.

---

## 11. Actuation & Safety Architecture

Because actuation is the one action with physical consequences, it receives layered safeguards that alerting does not (principle P5, NFR-5). Every safeguard below is mandatory.

- **Corroboration (2-of-N).** Actuation requires at least two modalities independently above threshold (§9.5) — a single anomalous modality can alert but cannot actuate.
- **Sustained-condition debounce.** The response threshold must be exceeded continuously across several consecutive samples (on the order of a few seconds) before the relay fires; a single instantaneous spike from noise or a transient glitch is rejected.
- **Rate-limiting / cooldown.** A minimum interval must elapse between actuations, preventing relay chattering if the fused score oscillates near the threshold — protecting both the relay's mechanical life and the switched machine.
- **Boot-safe default state.** On power-up and after any Wi-Fi reconnect, the firmware explicitly forces the relay to its known-safe state before any other logic runs, rather than inheriting whatever state existed before.
- **Full attempt logging.** Every actuation decision — including spikes suppressed by debounce, cooldown, or corroboration — is logged with its contributing per-modality scores, so any action (or suppressed action) is fully reconstructable and available for threshold tuning.
- **Physical, firmware-independent override.** A manual switch in series with the relay (§7.4) allows a human to force the safe state regardless of firmware state. This is the safeguard that covers the case where the firmware itself is the fault, which no software safeguard can cover.

**Demo-safety scoping.** The switched load is a real low-voltage/DC machine. Mains-AC switching is documented as future production hardening and is out of scope (§24).

---

## 12. Communication & Transport Architecture

### 12.1 Device-to-cloud transport — HTTPS (not MQTT)
The device transmits to the cloud via **authenticated HTTPS POST to a Supabase Edge Function**. This decision was reached by challenging the conventional MQTT-broker choice from first principles.

**Why HTTPS wins at this scale.** REZON's topology is one device, one direction, small payloads every one to two seconds, mains-powered. MQTT's genuine advantages — publish/subscribe fan-out to many subscribers, persistent-connection efficiency at high message rates, and broker-managed QoS delivery — all address problems REZON does not have at n=1. Because the ingestion compute is already a Supabase Edge Function, HTTPS reaches it in a single hop; MQTT would require device → broker → forwarder → Supabase, introducing a broker to run, secure, and maintain (or an additional managed-broker vendor) for no capability REZON needs. HTTPS also neutralizes MQTT's usual power-efficiency advantage, which is irrelevant to a mains-powered device.

**The honest framing (preserved for reviewers).** The correct statement is not "HTTPS is universally better" but "HTTPS is the correct choice at single-device scale; MQTT becomes the right call at fleet scale." The fleet-scale threshold and the migration path are documented in §21. No hybrid is used: adding a broker back solely for OTA notification would reintroduce broker infrastructure for a job that HTTPS polling handles adequately.

### 12.2 Idempotency — the mandatory cost of choosing HTTPS
Dropping MQTT means dropping broker-managed QoS delivery guarantees. The replacement is **device-side retry with an idempotency key**: each submission carries a **monotonic per-device sequence number**, and the server de-duplicates via a uniqueness constraint. This is not optional. Without it, the common failure mode where a POST succeeds server-side but its acknowledgment is lost over flaky Wi-Fi would cause the device's retry to double-write telemetry and, worse, potentially double-fire anomaly records. The idempotency key makes retries safe and satisfies NFR-7. On repeated failure, the device buffers to SD (§15) and submits when connectivity returns.

### 12.3 Data minimization (the privacy guarantee)
Only features and scores are transmitted — never raw audio. This is structural: the device has no code path that transmits raw audio. This is what makes NFR-1 an architectural property rather than a policy.

### 12.4 Device identity and authentication
Each device is provisioned once with a **unique long-lived secret**, stored in protected flash (NVS) and sent only as an authorization header on each request. The Edge Function validates this secret server-side against a stored hash before writing anything, and never trusts a client-supplied device identifier alone. **Row-Level Security** (§16) scopes each device's access to only its own rows, so even a worst-case key compromise cannot let one device read or write another's data. This is deliberately minimal — no token-refresh choreography, no OAuth — correctly sized for a single MCU-class device.

### 12.5 OTA update mechanism and rollback
When the local tier publishes a validated new model, the device adopts it through a multi-layered safe process:
1. Download the new model to SD (never directly into active use).
2. Verify its checksum against the announced value.
3. Perform a sandboxed dry-run load to confirm the model initializes correctly.
4. Only on success, atomically switch the active model to the new one.
5. On any failure at any step, automatically revert to the last known-good model.

Beneath this, the ESP32-S3's **dual-partition bootloader** provides a second, independent safety net: if a new firmware image fails to boot healthily, the bootloader itself reverts to the previous partition. Two independent rollback layers exist because a bricked device in the field is the worst outcome. This satisfies NFR-10's OTA-integrity requirement.

---

## 13. Cloud Architecture — Always-On Ingest & Serve Tier

### 13.1 Provider choice — Supabase (single vendor)
The cloud tier is **Supabase alone**, deliberately consolidating four responsibilities into one account to minimize moving parts and operational surface (principle P3, NFR-9). Supabase was selected over document/NoSQL platforms (Firebase, Appwrite) because REZON's data is fundamentally **relational** — structured sensor readings, joins across devices, events, and models, and time-bucketed queries — and Supabase is built on real PostgreSQL, whereas the alternatives' document models are a genuine mismatch. This is engineering reasoning, not preference.

### 13.2 Responsibilities
Supabase provides, in one project:
- **PostgreSQL database** — stores recent telemetry and all relational metadata (device registry, anomaly and actuation events with per-modality contributions, model references, user accounts). Plain relational tables; the heavy time-series machinery lives on the local tier (§14, §15), because no free managed Postgres currently offers the full time-series feature set REZON's history layer needs.
- **Authentication** — the login and role system for the public product (§16, §17).
- **Storage** — holds published model files for the device to download during OTA.
- **Edge Functions** — the serverless HTTPS ingestion endpoint the device authenticates to and posts to, plus any lightweight read APIs the frontend requires.

### 13.3 Operational caveat
Supabase's free tier pauses a project after an extended period of complete inactivity. A running device prevents this in practice; if the device is powered off for an extended break, a brief manual resume (or a trivial scheduled keep-alive) restores it. This is documented, accepted, and mitigated (§20), not hidden.

---

## 14. Local / MLOps Tier Architecture

### 14.1 Role and rationale
The operator's local machine hosts the heavy AI-lifecycle work as a single Dockerized stack. It is **not always-on and does not receive live device traffic**; instead it **pulls** data from the cloud into its own environment. This one-directional pull (cloud is upstream, local is a richer downstream consumer) is deliberate: there is no bidirectional synchronization, therefore no conflict-resolution problem to design or debug (principle P2, P3).

### 14.2 Components
- **Full self-hosted TimescaleDB** — the complete historical store, with hypertables, compression, and continuous aggregates. It lives locally specifically because the operator controls the license and feature set here, unrestricted, whereas managed free tiers cripple exactly these time-series features.
- **MLflow** — the model registry and experiment tracker. Every trained model is versioned with the data snapshot and metrics that produced it. This is load-bearing for the OTA rollback story (§12.5): "revert to the last known-good model" is only a well-defined operation because MLflow makes "which model, trained on what" an answerable question. It is retained even at single-device scale for exactly this reason.
- **Evidently — used as a library, not a standing service** — computes drift (whether a modality's reading distribution has shifted from its training baseline). As a library call inside the scheduled script, it provides credible drift mathematics without operating another service.
- **Grafana** — deep technical/operational dashboards for the operator (raw telemetry, drift internals, model-version state). This is admin tooling, distinct from the public product, and is reachable only over the private network (§16).
- **A single scheduled script — the orchestration.** It runs the linear sequence: check drift → if triggered, retrain → validate the new model against held-out data → register in MLflow → publish to Supabase Storage for OTA. This **replaced a workflow orchestrator (Airflow/Prefect)** after challenging that choice: REZON's pipeline is a linear sequence with one conditional branch, which is not the DAG-shaped problem orchestration engines exist to manage. A scheduled script is more debuggable for a solo operator, and choosing it over heavyweight tooling is a demonstration of right-sizing judgment (P3).

### 14.3 The retraining loop
Drift detection is not merely observational — it is the trigger. When Evidently reports drift beyond a threshold, the script retrains the audio model on recent normal data, validates that the new model is not worse than the incumbent on held-out data (a hard gate — a degraded model is never published), versions it in MLflow, and stages it to Supabase Storage, from which the device adopts it via the safe OTA process (§12.5). The same pipeline performs the initial field-calibration fine-tuning (§10.4).

---

## 15. Data & Storage Architecture

### 15.1 Storage tiers and flow
- **Device SD buffer** — holds recent raw telemetry and audio locally; serves as the retry buffer (§12.2) and as one copy of recent data.
- **Cloud (Supabase Postgres)** — recent telemetry plus all relational metadata; always available.
- **Local (TimescaleDB)** — the complete historical archive with time-series-native features.

Data flows in one direction: device → cloud (live) → local (periodic pull). No bidirectional sync exists, by design.

### 15.2 Durability model (three-copy)
Recent telemetry exists in up to **three places** — the device SD buffer, Supabase, and (after each pull) local TimescaleDB — satisfying NFR-8. This redundancy is a deliberate engineering choice: it means the loss of any single storage location does not lose recent data. To make it effective, the **local pull is frequent and incremental** rather than a rare large batch, minimizing the window during which Supabase is the sole copy of the newest telemetry, and a defined reconciliation step on each pull ensures the local archive converges to the complete record.
*(Decision-log note D-19 records that right-sizing this down to "accepted risk plus the SD buffer" was considered; full redundancy was retained deliberately because the marginal cost is low and the operator preferred a genuine durability guarantee over an accepted-loss window.)*

### 15.3 Retention and aggregation
High-frequency telemetry grows far faster than any other data. From day one, the local TimescaleDB applies a **retention policy** (raw-resolution data kept for a bounded window, then thinned) and **continuous aggregates** (automatically maintained hourly/daily rollups). Long-range dashboards query the aggregates, not the raw table. Designing this in from the start — rather than discovering query slowdowns months later — is a deliberate pre-emption of a classic time-series failure mode.

### 15.4 Schema shape (conceptual)
Core relational entities: devices (identity, health, active-model reference), telemetry (timestamped per-modality features and scores, keyed by device and sequence number for idempotency), anomaly/actuation events (with per-modality contributions for explainability), model registry references (versions, metrics, training-data snapshot, status), and users/roles. The idempotency sequence number carries a uniqueness constraint at the ingestion boundary (§12.2).

---

## 16. Security Architecture

Security is layered across the whole system and sized for a single-device, solo-operated deployment — real where it matters, not theatrical (NFR-10).

- **Transport.** All device-to-cloud traffic is HTTPS/TLS. Raw audio never leaves the device.
- **Device identity.** Unique per-device secret in protected flash, validated server-side against a hash; Row-Level Security scopes each device to its own data (§12.4).
- **Public product.** Real authentication and role separation (operator vs. viewer) via Supabase Auth.
- **Admin-tooling isolation.** Grafana, MLflow, and the local database are **never exposed to the public internet.** They are reachable only over **Tailscale**, a private WireGuard-based mesh joining only the operator's own devices. This is a deliberate, current best-practice choice: rather than exposing admin services publicly and defending them with passwords (a permanent attack surface to maintain), it removes public exposure entirely, eliminating a whole category of ongoing security work.
- **OTA integrity.** Checksum-verified, dry-run-validated, rollback-protected updates (§12.5).
- **Deliberately deferred (documented future hardening, §24).** The ESP32-S3's Secure Boot and Flash Encryption rely on irreversible one-time hardware fuses with real bricking risk; burning them onto the only device on a deadline is inappropriate. They are prototyped on a spare board and documented as the production-hardening path, not built into the core deliverable.

### 16.1 Authorization model
Two roles on the public product: **operator** (full: device management, OTA control, calibration, incident review/labeling) and **viewer** (read-only live status, incidents, analytics). Admin-plane tools (Grafana/MLflow) sit entirely outside this model, gated by network isolation rather than application roles — which is stronger, because an unexposed service cannot be attacked through its login.

---

## 17. Frontend & UX Architecture

### 17.1 Intent
REZON must present as a genuine product, not an operations dashboard. It therefore has a purpose-built web application; Grafana is retained separately as operator-only deep-dive tooling (§14). The two are intentionally different surfaces for different audiences.

### 17.2 Stack
Next.js with a modern component system (shadcn/ui + Tailwind) for a polished, professional UI without hand-built components, hosted on Vercel's free tier. Next.js/Vercel was chosen over leaner alternatives for an honest feasibility reason: for a solo developer on a deadline, the far larger ecosystem — abundant solved examples for almost any problem — outweighs a marginally leaner framework.

### 17.3 Product structure — three zones
The application is organized to match the operator's three real jobs:

**Monitor.**
- *Live status* — the at-a-glance "is the space normal right now" hero view: the fused score, the alert/response thresholds, per-modality contribution bars, machine draw, uptime, and the actuation control panel (auto-response toggle, override state, cooldown, and an emergency-cut control backed by the physical override).
- *Sensor streams* — live per-modality waveforms.
- *Incidents* — the incident log, **sorted by model uncertainty** (events closest to the decision boundary first), so limited human review effort is spent where the model was least confident (an active-learning practice); each incident opens a detail view with the per-modality breakdown, buffered sensor context, the explicit reason it fired, and true/false labeling that feeds retraining.

**Analyze.**
- *Analytics* — historical intelligence: trend of the fused score, modality attribution, an hour-by-day activity heatmap, and baseline-stability metrics.
- *Model & drift* — active model, held-out AUC, per-modality drift status, and the retraining pipeline shown as a visible staged flow.

**Manage.**
- *Device & machine* — device health telemetry (connection, heartbeat, firmware, heap, PSRAM, signal, SD buffer) and the monitored machine's electrical-health status from the current modality, plus per-sensor calibration controls.
- *Deployments* — the OTA control surface: staged-model details with held-out AUC and checksum, a deploy action, and rollback/deployment history.

**Public status view.** A read-only, no-login page showing simplified live status ("currently normal / last anomaly N hours ago"), so the system reads as a genuinely shipped product rather than a login wall.

### 17.4 Explainability and calibration as first-class UX
Two backend concepts are deliberately surfaced as product features: **alert explainability** (every alert shows its per-modality contribution, turning an opaque flag into something a user can reason about) and **field-calibration progress** (the burn-in period is surfaced as an onboarding flow — "your device is learning this space — N days remaining" — turning a backend milestone into a visible product experience).

### 17.5 Resilience states (mandatory)
Because this is a live-monitoring UI whose backend may be unreachable (device offline, cloud paused, local machine asleep), the frontend must render honest **stale/disconnected states** — "last update N minutes ago," never a frozen chart that implies live data. A frozen-looking-live dashboard is the classic demo-day failure and is explicitly designed against.

### 17.6 Public/private split
The web app is genuinely public with real authentication (§16). Operator tooling (Grafana, MLflow, database) is not publicly exposed at all. The public app communicates with the backend only through controlled, authenticated queries; it never exposes internals directly.

---

## 18. Observability & Operations

Sized to be genuinely useful to a solo operator (NFR-12), not enterprise theater.

- **System/product health.** Grafana for telemetry and device health; an uptime check on the public endpoint; the scheduled script's success/failure visible in its own logs.
- **ML health.** Evidently drift reports per modality — not passive dashboards but the active trigger for retraining (§14.3), surfaced in the product's Model & drift view.
- **Firmware observability.** Built-in logging to serial during development; a rotating log file on the SD card for events that must survive power-down (OTA failures, crash reasons, suppressed-actuation events); and core-dump-to-flash enabled from day one so a crash yields a real stack trace rather than a guess.
- **Cloud logging.** Each Edge Function's own logs suffice; structured (JSON) logging in the ingestion function makes any needed log search straightforward. No log-aggregation platform is used — that would solve a coordination problem this scale does not have (P3).

---

## 19. End-to-End Workflow Lifecycles

**Workflow A — Normal operation.** Power on → firmware forces relay to safe state → five sensors sample continuously → environment readings compensate the gas reading and the current signal is filtered → five anomaly scores computed and fused → fused score stays low → LED green → anonymized features/scores submitted via authenticated, idempotent HTTPS → cloud stores them, the public product shows "normal," and (when running) the local tier pulls the data into TimescaleDB while the space's baseline picture accumulates.

**Workflow B — Anomaly → alert → actuation.** A modality's score climbs → fused score crosses the alert threshold → LED red, buzzer sounds, alert submitted (and visible in the product within seconds with its per-modality explanation) → if the fused score also crosses the response threshold, and at least two modalities independently agree, and the condition sustains through the debounce window, and the cooldown has elapsed, and the physical override permits it → the relay trips, cutting power to the machine → the actuation, with its full contributing-score breakdown, is logged and submitted. If any gate is not satisfied, the suppression is logged with its reason.

**Workflow C — Drift → retrain → redeploy.** Independently of any anomaly, telemetry accumulates in TimescaleDB → the scheduled script periodically runs Evidently to test whether "normal" has shifted → if drift crosses threshold, it retrains the audio model on recent normal data, validates the new model is not worse on held-out data, versions it in MLflow, and publishes it to Supabase Storage → the device is notified, downloads it, checksum-verifies, dry-run-loads, and atomically adopts it — with automatic rollback at any failure. The device's understanding of "normal" updates itself with no human in the loop.

**Workflow D — Field-calibration burn-in (first deployment).** Device deploys in logging-only mode (scores computed, alerts suppressed, actuation disabled) → collects genuine local telemetry for one to two weeks (progress shown in the product's onboarding view, MQ135 conditioning absorbed within the same window) → the retraining pipeline runs once to calibrate the model and fusion weights/thresholds to the real space → the device graduates to full alert and actuation mode. This is a required milestone before the system's decisions are trusted.

---

## 20. Failure Modes & Handling

| Failure | Handling |
|---|---|
| Network unavailable | Device keeps sensing, scoring, alerting locally, and can actuate (NFR-2). Telemetry buffers to SD and submits on reconnect; idempotency prevents duplicates. |
| POST succeeds but ack lost | Idempotency key + server dedup makes the retry safe (§12.2). |
| Cloud (Supabase) paused/unreachable | Device unaffected (edge autonomy). Public product degrades to honest stale states (§17.5). Recent data still exists on device SD and in local TimescaleDB (§15.2). |
| Local machine off | No live effect — its jobs (history, drift, retrain) are periodic. Retraining simply runs on next start. |
| Bad model after OTA | Dry-run load catches init failure pre-swap; automatic model rollback and dual-partition bootloader rollback catch boot/runtime failure; physical override covers a model that loads but misbehaves. |
| Sensor failure (e.g., DHT22 bad read) | Isolated in acquisition; degrades gracefully without stalling the pipeline; the affected modality's contribution is handled rather than corrupting fusion. |
| Fused score stuck high | Cooldown + rate-limiting prevent relay chattering; logging captures the condition; override available. |
| Institutional network blocks outbound HTTPS | Detected during pre-deployment testing; mitigated by hotspot fallback and honest documentation (an operational, not architectural, risk). |
| Device powered off for a long break | Supabase may pause; brief manual resume or scheduled keep-alive restores it (§13.3). |

---

## 21. Scalability & Evolution Path

REZON is correctly a single-device system today (P3). The architecture nonetheless has a clean evolution path, documented not to build now but to demonstrate the seams are understood:

- **Transport.** At fleet scale, MQTT's fan-out and connection management begin to earn their keep; the migration is device → broker → ingestion, replacing per-device HTTPS. The idempotency and per-device-secret models already in place carry forward.
- **Identity.** The per-device secret + Row-Level-Security model scales to many devices without redesign — each device is already scoped to its own data.
- **Cloud before local.** The always-on cloud tier scales first (managed Postgres/Functions scale horizontally); the local tier would formalize into a proper scheduled service or move to hosted compute only when fleet data volume demands it.
- **Model management.** MLflow already versions models; fleet rollout would add staged/canary deployment across device cohorts — a natural extension of the existing registry-and-OTA machinery.

---

## 22. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Audio model doesn't generalize to the real space | Medium | High | Field-calibration burn-in (§10.4) as a required milestone; held-out evaluation; IDNN-vs-AE A/B |
| R-2 | Idempotency not implemented, causing duplicate/double-fired records | Low (now specified) | High | Mandatory sequence-number + server dedup (§12.2) |
| R-3 | ACS712 noise makes the current modality unreliable | Medium | Medium | Mandatory moving-average + alpha filtering (§7.3, §9.4) |
| R-4 | Vibration scorer misses band-shift faults | Medium | Medium | Spectral-band features, not raw amplitude (§9.3) |
| R-5 | Autonomous actuation misfires | Low | High | Corroboration + debounce + cooldown + boot-safe + logging + physical override (§11) |
| R-6 | Institutional network blocks HTTPS during demo | Medium | Medium | Pre-test on the demo network; hotspot/recorded fallback |
| R-7 | Supabase pause during an inactive break | Medium | Low | Manual resume or scheduled keep-alive (§13.3) |
| R-8 | Supabase free-tier data-loss window | Low | Low–Medium | Three-copy durability + frequent incremental pull (§15.2) |
| R-9 | Perpetual redesign consuming build runway | Medium | High | Design is frozen by this document; further review is out of scope |
| R-10 | Secure Boot bricking a device if attempted on the main unit | Low | High | Deferred to future hardening; prototyped only on a spare board (§16) |

---

## 23. Decision Log

| ID | Decision | Alternatives considered | Rationale |
|---|---|---|---|
| D-01 | ESP32-S3-WROOM-1 N16R8 as MCU | NPU MCUs, dedicated audio-AI silicon | PSRAM fits the model; integrated Wi-Fi needed for OTA; large community de-risks solo build; mains power neutralizes low-power silicon's edge |
| D-02 | IDNN for audio | Plain autoencoder | Better on non-stationary sound; same size class; retained as A/B baseline and treated as a hypothesis to validate |
| D-03 | Statistical monitors for vibration/gas/current | Neural nets per modality | Cheaper, interpretable, self-calibrating; dissolves the training-data problem for 4 of 5 modalities |
| D-04 | Spectral-band vibration features | Raw-amplitude Z-score | Closes the band-shift fault blind spot at near-zero cost |
| D-05 | QAT quantization | Post-training quantization | Preserves the small-error sensitivity the anomaly decision depends on |
| D-06 | 2-of-N corroboration + two thresholds | Single threshold; naive sum | Prevents single-sensor false actuation; separates the cost of a false alert from a false action |
| D-07 | Heterogeneous per-modality models | Single unified multi-input model | A unified model reintroduces the training-data problem the heterogeneous design dissolves |
| D-08 | HTTPS transport | MQTT + broker | One hop vs. broker infrastructure at n=1; MQTT's advantages are fleet-scale; documented migration path |
| D-09 | Idempotency key + server dedup | Rely on QoS (unavailable without broker) | Mandatory replacement for the delivery guarantee lost by dropping MQTT |
| D-10 | Supabase single-vendor cloud | Firebase/Appwrite; multi-vendor stitch | Relational data model fits Postgres; one account minimizes operational surface |
| D-11 | Scheduled script | Airflow/Prefect | Pipeline is a linear branch, not a DAG; more debuggable solo; right-sizing |
| D-12 | Local full TimescaleDB, cloud plain Postgres | Full TimescaleDB in cloud | No free managed Postgres offers the full time-series feature set; keep it where the license/features are unrestricted |
| D-13 | Tailscale admin isolation | Public exposure + passwords | Removes the attack surface entirely rather than defending it |
| D-14 | Drop Oracle Cloud dependency | Assume eventual paid upgrade | Oracle Always Free proved unreliable ("out of capacity"); no dependency on a single unreliable host |
| D-15 | ACS712 as a true 5th modality | Omit; use as generic sensor | It observes the actuation target itself — the one thing no environmental sensor can |
| D-16 | Physical manual override | Software safeguards only | Covers the case where the firmware itself is the fault |
| D-17 | Field-calibration burn-in | Deploy trained model cold | Calibrates a public-data model to the real environment before trusting it |
| D-18 | Next.js/Vercel frontend | Leaner framework/host | Ecosystem depth outweighs leanness for a solo deadline build |
| D-19 | Three-copy durability retained as a full feature | Downgrade to "accepted risk + SD buffer" | Marginal cost is low; operator preferred a genuine durability guarantee over an accepted-loss window |

---

## 24. Out of Scope (with rationale)

Each item was evaluated and consciously excluded as wrong for a single-device, solo, capstone-scale system — recorded here so each reads as a decision, not an oversight: multi-device fleet management and orchestration; Kubernetes; a message broker (removed once HTTPS-direct proved sufficient at n=1); a workflow orchestrator (replaced by a scheduled script); Redis/task queues; a second cloud database vendor; cloud-side shadow/validation inference (the telemetry pipeline already gives full visibility into the one device); Secure Boot / Flash Encryption in release mode (irreversible-fuse bricking risk — deferred to documented hardening); a formal security audit, SLA, and multi-region redundancy; and mains-AC load switching (low-voltage/DC only for the build). The **week-by-week implementation/build sequence** is also out of scope for this document by design — it is a separate deliverable.

---

## 25. Appendices

### Appendix A — Component-to-responsibility matrix (summary)
Edge: sensing, feature extraction, inference, fusion, decision, local alert, actuation, OTA client. Cloud (Supabase): ingestion, recent storage, metadata, auth, model-file serving, product APIs. Local: full history, drift detection, retraining, model registry, operator dashboards, model publishing. Frontend (Vercel): the public product across Monitor/Analyze/Manage plus the public status view.

### Appendix B — Modality-to-method matrix (summary)
Audio → IDNN (trained, QAT INT8). Vibration → statistical monitor on spectral-band features. Gas → temperature/humidity-compensated statistical monitor. Current → filtered statistical monitor. Environment → contextual features + gas compensation input. Fusion → weighted combination with 2-of-N corroboration and burn-in-calibrated weights.

### Appendix C — Threshold summary
Alert threshold (lower): local + remote alert; single-modality-triggerable. Response threshold (higher): actuation candidate, gated by corroboration + debounce + cooldown + boot-safe + physical override. Both calibrated from field-calibration burn-in data.

---

*End of Architecture Design Document. This is the canonical, design-frozen reference for REZON. Every finalized decision from all design and review phases is incorporated herein; where a decision was contested, its alternative and rationale are preserved in the decision log (§23). Implementation may begin against this document.*
