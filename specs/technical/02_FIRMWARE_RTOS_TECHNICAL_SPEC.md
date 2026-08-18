# REZON — Firmware / RTOS Technical Specification
**Phase B.2. Resolves Parameter Registry entries #5, #6, #16, #19, #20, #21 and Boundary #1 (device side). Safety-critical per METHODOLOGY.md §3. ✅ Full sign-off obtained on §5 in its entirety, including the original debounce/cooldown/no-auto-reverse design (`DEC-015`) and the burn-in-mode gating added during the Phase B quality audit (`DEC-020`). CONFIRMED throughout, not analysis-only.

**Confidence key (adopted from B.1):** 🟢 standard practice/high confidence — 🟡 reasonable engineering default, validate in Phase 1 — 🔴 needs real hardware/datasheet data in hand.

---

## 1. RTOS task structure — real priorities, stack sizes, and communication

ESP-IDF FreeRTOS uses `configMAX_PRIORITIES = 25` by default (0 = lowest, 24 = highest, idle task = 0). Assignments:

| Task | Core | Priority | Stack (bytes) | Confidence |
|---|---|---|---|---|
| Sensor Acquisition | 0 | 20 | 4096 | 🟡 high enough to preempt everything on Core 0; stack is modest since I2S/I2C reads are simple, DMA does the heavy lifting |
| Feature Extraction | 0 | 10 | 8192 | 🟡 FFT/mel-filterbank computation needs meaningfully more stack than acquisition |
| Inference & Fusion | 1 | 12 | 8192 | 🟡 stack itself stays moderate — the model's tensor arena is NOT on this stack (see §1.2) |
| Networking | 1 | 6 | 8192 | 🟢 mbedTLS (HTTPS/TLS) is genuinely stack-hungry; under-sizing this is a common, hard-to-diagnose crash source |
| Local Output & Actuation | 1 | 3 | 2048 | 🟢 GPIO writes only, minimal stack need |

🟡 **These priority numbers are relative, not absolute-correct on first try** — validate empirically in Phase 1 that Core 0's acquisition task genuinely never gets preempted by anything (confirm via a deliberate stress test: saturate Core 1 with networking + inference simultaneously, verify audio capture stays glitch-free).

### 1.1 Inter-task communication (resolves the "queue vs. shared-memory" gap)

**Audio path (Acquisition → Feature Extraction):** NOT a queue-per-sample. I2S DMA writes into a double-buffered ring buffer; when a buffer fills, the DMA ISR signals a **binary semaphore** (`xSemaphoreGiveFromISR`) that wakes the Feature Extraction task. This is standard practice for high-rate DMA-fed pipelines — a queue would add per-sample overhead the audio rate doesn't need to pay.

**Everything else (Feature Extraction → Inference, Inference → Networking, Inference → Output):** FreeRTOS **queues** (`xQueueSend`/`xQueueReceive`), one queue per hop, each sized for 2-3 items (enough to absorb normal jitter, small enough that a backed-up queue is immediately visible as a real problem rather than silently buffering forever). Queue item = a struct pointer (heap-allocated, freed by the consumer), not the raw data copied by value, to keep queue operations cheap.

### 1.2 Tensor arena placement (resolves how B.1's ~55K-parameter model actually fits)

The IDNN's TFLite Micro tensor arena (working memory for inference, independent of the model's own weights) is allocated as a **static buffer in PSRAM**, not on the Inference task's own stack and not in internal SRAM. 🟡 Propose an initial arena size of 64KB (generous headroom over what a ~55K-parameter FC model needs) — **validate the actual required size empirically in Phase 1** using TFLite Micro's own arena-usage reporting, then right-size down if there's room to reclaim PSRAM for other uses.

---

## 2. Sensor polling rates (resolves Registry #21)

| Sensor | Rate | Confidence | Justification |
|---|---|---|---|
| DHT22 | Once per 2.5s | 🟢 | DHT22's own datasheet specifies a minimum 2-second interval between reads; 2.5s adds margin |
| BMP280 | Once per 5s | 🟡 | Pressure/temperature context changes slowly; no value in reading faster |
| MQ135 | Once per 1s | 🟡 | Fast enough to catch a developing gas event without over-sampling a slow-responding sensor |
| ACS712 | 100Hz (10ms) | 🟢 | Locked in B.1 §5 |
| MPU-6050 (vibration) | 250Hz | 🟢 | Locked in B.1 §3 |
| SW-420 | Edge-triggered GPIO interrupt (not polled) | 🟢 | A mechanical switch is naturally event-driven — an ISR on the GPIO pin, not a polling loop, is both simpler and never misses a trigger between poll intervals |

### 2.1 SW-420 — event log and hardware corroboration (added post-Phase-B, DEC-010, resolves AI/ML Spec §7.5)

```
ISR (SW420_GPIO, rising edge):
    timestamp = now()
    push (timestamp) into sw420_trigger_ring_buffer   # small ring buffer,
                                                        # e.g. last 20 triggers —
                                                        # this is a low-rate
                                                        # mechanical event, not a
                                                        # high-frequency stream

# Called from the Inference & Fusion task, only when vibration is one of the
# corroborating modalities for an actuation candidate (AI/ML Spec §7.4):
function check_sw420_corroboration(candidate_window_start, candidate_window_end):
    for each timestamp in sw420_trigger_ring_buffer:
        if candidate_window_start <= timestamp <= candidate_window_end:
            return true    # hw_confirmed
    return false            # hw_confirmed = false — logged as a flagged
                             # inconsistency per AI/ML Spec §7.5, not a gate
```

🟢 Implemented as a GPIO interrupt service routine (ISR) rather than added to the Sensor Acquisition Task's polling loop — appropriate for a low-rate, edge-triggered mechanical signal, and keeps the acquisition task's own timing (protecting audio sampling, §1) completely undisturbed by this addition.

---

## 3. Debounce and cooldown (resolves Registry #5, #6, #20 — the highest-priority risk trio)

### 3.1 The relay's real mechanical limit (Registry #20) — honestly flagged

🔴 **This cannot be finalized without the actual purchased relay's datasheet in hand.** For a typical Songle SRD-05VDC-SL-C-class 5V relay (the component named in the ADD), published mechanical life ratings are commonly on the order of 100,000+ operate cycles, with operate/release times in the tens-of-milliseconds range — but that's the relay's own physical minimum, not a sensible *operational* cadence. Because REZON is switching an inductive load (a motor), repeated fast cycling also raises real contact-arcing/wear concerns beyond the bare mechanical spec. **Action item for Phase 1:** confirm the exact purchased relay's datasheet numbers before finalizing; until then, the cooldown value below is set with deliberate, large margin above any plausible mechanical minimum, precisely because the actual datasheet isn't in hand yet.

**Also flagging honestly:** the earlier frontend prototype displayed "Cooldown: 60s" in its UI mockup. Like the threshold values caught in Phase A (DEC-002), this was an invented mockup number, not a value that had actually been derived — this section is where it either gets confirmed correct by independent reasoning or corrected. It happens to land close to the value derived below, but that's coincidence worth naming, not evidence.

### 3.2 Debounce duration (Registry #5)

🟡 **4 consecutive fusion-decision cycles** at the ~1-second fusion cadence (established in B.1 §3 for vibration's analysis cadence, and matching the inference task's natural cycle time) **≈ 4 seconds sustained** above the response threshold before a condition becomes an actuation candidate. Short enough to react to a genuinely persistent event promptly; long enough that a single noisy 1-second sample can't trigger anything alone.

### 3.3 Cooldown duration (Registry #6)

🟡 **60 seconds minimum between actuations.** Derivation: this is not the relay's bare mechanical minimum (unknown until real datasheet data per §3.1) — it's a deliberately large operational margin chosen for two independent reasons: (a) it gives a human operator a realistic window to notice and respond to a logged actuation before the system could act again, and (b) it protects against exactly the "hovering near the threshold" chatter scenario the ADD's own actuation-safety design (§11) was built to prevent. **Validate in Phase 1** against the real relay's datasheet once available — this value should only ever move *up* from evidence of a tighter real constraint, never down without a specific, logged reason.

---

## 4. NFR-4 — a real, testable real-time bound (resolves Registry #19)

The ADD's "near-real-time... single-digit seconds" becomes two separate, testable numbers, because alerting and actuation have different response-time expectations by design (ADD §9.6):

| Path | Bound | Confidence |
|---|---|---|
| Sustained anomaly → local alert (LED/buzzer) | ≤ 2 seconds | 🟡 one fusion cycle (~1s) + output task dispatch (near-instant) + margin |
| Sustained anomaly → actuation (if all gates pass) | ≤ 4s (debounce) + cooldown-check (instant) + output dispatch ≈ **≤ 5 seconds** | 🟡 dominated by the debounce window from §3.2, which is intentionally the slow part |

Both bounds are measured **on-device**, independent of network latency — consistent with ADD §9.1/§11's edge-autonomy principle; the cloud reporting path (§6 below) has its own, separate, non-safety-critical latency budget.

---

## 5. The actuation state machine (safety-critical — resolves ADD §11 into exact logic)

**A real gap found during the Phase B cross-spec consistency check, closed here: this state machine had no explicit representation of burn-in mode.** ADD §10.4 and AI/ML Spec §10 both require alerts suppressed and actuation entirely disabled during the field-calibration burn-in period — but nothing in the original version of this state machine actually enforced that. Without an explicit gate, there was no firmware-level guarantee the device couldn't actuate before calibration completes, which is precisely the failure burn-in exists to prevent. **This addition is safety-critical (touches ADD §11 directly) and requires explicit developer sign-off before being treated as settled, per METHODOLOGY.md §3 — same standard as the rest of this section, not a lighter-weight fix.**

```
GLOBAL FLAG: operating_mode ∈ {BURN_IN, FULL_OPERATION}
  - Starts at BURN_IN on first-ever device provisioning.
  - Transitions to FULL_OPERATION only when: (a) AI/ML Spec §10's
    stopping-rule criteria are met, AND (b) the calibration fine-tune
    pass completes and the device receives calibrated thresholds/
    weights via the standard OTA mechanism (§7 below).
  - Once FULL_OPERATION, does not revert to BURN_IN automatically —
    a future redeployment to a new physical space would need this
    reset explicitly (out of scope for this build — REZON deploys once).

STATES: BOOT_SAFE, MONITORING, CANDIDATE, COOLDOWN

BOOT_SAFE (entered on power-up AND on any Wi-Fi reconnect event):
  - Force relay GPIO to safe/off state immediately, before any other
    firmware logic runs.
  - Transition to MONITORING unconditionally once the safe state is
    confirmed written.

MONITORING (the normal operating state):
  - Each fusion cycle (~1s): compute fused_score and corroboration
    exactly as normal (per AI/ML Spec §7.3-7.4) REGARDLESS of
    operating_mode — burn-in still needs real computed scores logged
    for the stopping-rule check (AI/ML Spec §10) and for the eventual
    calibration fit. Only the RESPONSE to those scores differs by mode:

    if operating_mode == BURN_IN:
        - log fused_score + per-modality scores to telemetry as normal
        - alert path: SUPPRESSED — no LED/buzzer/remote alert dispatch,
          even if alert_threshold is crossed
        - NEVER transition to CANDIDATE, regardless of response_threshold
          or corroboration — actuation is structurally unreachable in
          this mode, not just "unlikely"
    else:  # FULL_OPERATION
        - Alert path: may fire on a single cycle, any modality — does
          not require state transition.
        - If response_threshold + corroboration conditions are met on
          a cycle: transition to CANDIDATE, start debounce counter at 1.

  - Physical override switch, checked every cycle regardless of
    state or operating_mode: if engaged, relay is forced to safe state
    and this state machine is bypassed entirely until override is
    released.

CANDIDATE (accumulating debounce confirmation — only reachable when
operating_mode == FULL_OPERATION, per MONITORING's gate above):
  - Each subsequent cycle: if response conditions still hold,
    increment debounce counter. If they DON'T hold on any cycle
    before reaching the debounce threshold, transition back to
    MONITORING (log the suppressed candidate — this is exactly
    the "spike rejected by debounce" case the ADD requires logging).
  - If debounce counter reaches 4 (§3.2) AND cooldown timer (since
    last actuation) has elapsed: ACTUATE (fire relay), log the full
    per-modality score breakdown that triggered it, transition to
    COOLDOWN, reset cooldown timer to 0.
  - If debounce counter reaches 4 but cooldown has NOT elapsed:
    log a suppressed-by-cooldown event (also required logging, per
    ADD §11), transition back to MONITORING without actuating.

COOLDOWN (post-actuation, enforcing the 60s minimum interval):
  - Relay stays in its actuated state (safe/off for the monitored
    machine) — cooldown governs re-actuation eligibility, not
    reverting the action itself. Reverting/re-arming the monitored
    machine is an explicit separate operator action (frontend
    "auto-response" toggle / manual control), not automatic.
  - Once 60s elapses since the actuation: transition to MONITORING.
  - Override switch remains checked every cycle throughout.
```

🟡 **One design point worth flagging explicitly for sign-off, not just noted in passing:** this state machine does NOT automatically restore power once cooldown elapses — actuation is a one-way safety action until a human (or the frontend's explicit "auto-response" control) re-arms it. This is a deliberate reading of ADD §11's intent (a physical safety action shouldn't silently self-reverse), but it's precise implementation-level behavior invented here, not restated verbatim from the ADD — flagging it for explicit confirmation, per the safety-critical carve-out.

## 6. OTA state machine (a second gap found and closed — resolves ADD §12.5 into exact logic)

**Also missing from the original version of this document.** ADD §12.5 describes the OTA safety properties (checksum-verified, dry-run tested, atomic swap, auto-rollback) narratively, but no document ever turned that into exact device-side state logic — the same category of gap as §5's burn-in mode, though this one sits outside the formal safety-critical carve-out (it's ADD §12.5, not §9/§11/§12.2), so it's logged as a standard reality-driven fix, not gated on sign-off.

```
STATES: IDLE, DOWNLOADING, VERIFYING, DRY_RUN, SWAPPING

IDLE (default — periodic check on the Networking Task's own low-priority cycle):
  - Periodically (🟡 propose once per hour — frequent enough to pick up
    a new model reasonably promptly, infrequent enough to not be a
    meaningful load): GET /models/latest (Backend Spec §3.2).
  - 204 No Content → stay IDLE.
  - 200 with a version newer than the device's current active_model_version
    → transition to DOWNLOADING.

DOWNLOADING:
  - Download the model file from the response's signed URL to SD card
    staging (never directly into the active model's flash location).
  - Success → transition to VERIFYING.
  - Failure (network error, timeout) → discard partial download, log,
    return to IDLE, retry on next periodic cycle.

VERIFYING:
  - Compute SHA-256 of the staged file, compare to the response's
    checksum_sha256.
  - Match → transition to DRY_RUN.
  - Mismatch → discard staged file, log as a Blocker-Report-worthy
    event (a checksum mismatch on a signed download is unusual enough
    to warrant investigation, not silent retry), return to IDLE.

DRY_RUN:
  - Load the staged model into a SEPARATE TFLite Micro interpreter
    instance with its own tensor arena — the currently-active model's
    arena and interpreter are untouched during this step.
  - Run one inference on a known dummy input, confirm it initializes
    and produces output without crashing or erroring.
  - Success → transition to SWAPPING.
  - Failure → discard staged file, log, return to IDLE (the currently-
    active model was never at risk during this whole process).

SWAPPING:
  - Atomically update the active-model pointer (an NVS flag indicating
    which staged file is authoritative) to the new model.
  - Update the device's reported active_model_version for the next
    telemetry POST.
  - Transition to IDLE.
```

**Two independent rollback layers, per ADD §12.5's explicit design — this state machine implements the first, the second is hardware-level and sits below it entirely:**
1. **Software rollback (this state machine's job):** 🟡 if the newly-active model produces N consecutive inference errors post-swap (propose N=5), automatically revert the active-model pointer to the previous known-good model and log the event.
2. **Hardware rollback (independent, ESP-IDF's own mechanism):** the ESP32-S3's dual-partition bootloader reverts at the firmware-image level if a new firmware image fails to boot healthily — this operates completely independently of the model-file-level logic above, catching a different, lower-level failure class.

---

## 7. Idempotency — device-side mechanism (resolves Registry #16 and Boundary #1, device half)

This is the fix for the real correctness risk identified in Phase A: a naive sequence number that resets on reboot would let the server's dedup table silently reject genuinely new post-reboot data as duplicates of pre-reboot data.

```
On first-ever boot (device provisioning):
  seq_counter = 0
  write seq_counter to NVS key "seq_checkpoint"

On every subsequent boot:
  seq_counter = read NVS key "seq_checkpoint"
  seq_counter += SEQ_CHECKPOINT_MARGIN   # see below — resolves reboot risk

On creating a new data point (telemetry, alert, or actuation event):
  this_seq = seq_counter
  seq_counter += 1
  attach this_seq to the outgoing HTTPS payload

On retry of a FAILED submission (network error, no server ack):
  reuse the SAME this_seq value — do NOT increment. This is what
  makes retries idempotent: identical data, identical sequence
  number, server-side dedup (Backend Spec, B.3) recognizes it as
  the same submission attempted again, not a new data point.

Periodic NVS checkpoint (not on every increment — flash wear):
  every 100 increments of seq_counter, write current seq_counter
  to NVS key "seq_checkpoint".

SEQ_CHECKPOINT_MARGIN = 100
  Why: NVS is only checkpointed every 100 increments, so an unclean
  reboot could lose up to 100 increments' worth of "true" counter
  state. Adding 100 on boot guarantees the resumed counter is always
  higher than any sequence number that could possibly have been
  used before the reboot — some sequence numbers get permanently
  skipped (never reused), which is fine, since uniqueness and
  monotonicity are the only real requirements, not density.
```

🟢 **Wraparound (also part of Registry #16):** a 32-bit unsigned counter, incrementing at most a few times per second, wraps after multiple centuries of continuous operation — not a practical concern at REZON's scale or lifespan. Documented as resolved, not deferred.

---

## Registry entries resolved by this document

#5 (debounce duration — 4 cycles/~4s), #6 (cooldown duration — 60s), #16 (idempotency device-side: NVS-persisted checkpoint-margin scheme, wraparound not a practical concern), #19 (NFR-4 exact bounds — ≤2s alert, ≤5s actuation), #20 (relay mechanical limit — honestly flagged as 🔴 pending real datasheet, cooldown set with deliberate margin above it), #21 (sensor polling rates for DHT22/BMP280/MQ135).

**18 of 26 resolved (12 from B.1 + 6 here). Remaining 8 (#4 already resolved pre-B.1, #17, #18, #22, #23, #24, #25, #26) belong to Backend and Local MLOps specs — Phase B.3-B.4.**
