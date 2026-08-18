# SESSION 06 — QAT, Held-Out A/B Evaluation, and On-Device Deployment
**Risk tier: HIGH-RISK (the actual empirical test of the IDNN hypothesis + first real on-device inference). Needs both your laptop GPU (training/QAT/export) and the real device (deployment).**
**Branch: `session/build-06-qat-eval-deploy`**
**Attach: `specs/technical/01_AI_ML_TECHNICAL_SPEC.md` §2, §8-9, `specs/technical/02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §1.2, `specs/sessions/SESSION_05_audio_training_stage1_2.md`, `specs/sessions/SESSION_03_rtos_skeleton_and_acquisition.md`**

---

## Agent Instructions

Three real, sequential things: (1) evaluate both Session 5 models on the held-out set — this is the actual moment the "IDNN vs. plain-AE, hypothesis not fact" question (AI/ML Spec §2) gets a real answer, not an assumption; (2) apply QAT to whichever model wins; (3) deploy the quantized model to the device, replacing Session 3's `stub_inference_task` with real inference. This is a **retrofit session** on `rezon_main.c` and the stub task file.

**What this session creates/modifies:**
- `training/evaluate.py` — NEW: real AUC computation, the actual A/B decision
- `training/qat.py` — NEW: the QAT procedure
- `training/export_tflite.py` — NEW: TFLite Micro conversion + C array export
- `main/inference_task.cc` — NEW (note `.cc` — TFLite Micro's C++ API requires this, wrapped for C interop per ESP-IDF convention)
- `main/inference_task.h` — NEW: C-linkage header
- `main/model_data.h` — NEW: the exported model as a C array (placeholder structure — real bytes come from Step 3's actual export run)
- `main/rezon_main.c` — MODIFIED: replace `stub_inference_task` with `inference_task`

---

## FILE 1: `training/evaluate.py`

```python
"""
AI/ML Spec §9: the actual A/B evaluation. Both models score the SAME
held-out set (normal held-out samples + synthetic-anomaly-injected
held-out samples, per Session 5's inject_synthetic_anomaly), and
whichever achieves the higher held-out AUC — provided it clears the
0.85 hard bar — is the model that proceeds to QAT and deployment.
"""
import numpy as np
from sklearn.metrics import roc_auc_score

AUC_HARD_BAR = 0.85  # AI/ML Spec §9 — the MLPerf Tiny reference bar


def compute_idnn_scores(model, inputs, targets):
    """Anomaly score = MSE between predicted and actual center frame."""
    predictions = model.predict(inputs, verbose=0)
    return np.mean((predictions - targets) ** 2, axis=1)


def compute_ae_scores(model, patches):
    """Anomaly score = MSE over the full reconstructed patch."""
    reconstructions = model.predict(patches, verbose=0)
    return np.mean((reconstructions - patches) ** 2, axis=1)


def evaluate_and_decide(idnn_model, ae_model, held_out_normal_idnn_x, held_out_normal_idnn_y,
                          held_out_anomaly_idnn_x, held_out_anomaly_idnn_y,
                          held_out_normal_ae, held_out_anomaly_ae):
    """Returns (winning_model_name, winning_model, auc_idnn, auc_ae) —
    an explicit, logged decision, not a silent default to IDNN."""

    idnn_normal_scores = compute_idnn_scores(idnn_model, held_out_normal_idnn_x, held_out_normal_idnn_y)
    idnn_anomaly_scores = compute_idnn_scores(idnn_model, held_out_anomaly_idnn_x, held_out_anomaly_idnn_y)
    idnn_labels = np.concatenate([np.zeros(len(idnn_normal_scores)), np.ones(len(idnn_anomaly_scores))])
    idnn_scores = np.concatenate([idnn_normal_scores, idnn_anomaly_scores])
    auc_idnn = roc_auc_score(idnn_labels, idnn_scores)

    ae_normal_scores = compute_ae_scores(ae_model, held_out_normal_ae)
    ae_anomaly_scores = compute_ae_scores(ae_model, held_out_anomaly_ae)
    ae_labels = np.concatenate([np.zeros(len(ae_normal_scores)), np.ones(len(ae_anomaly_scores))])
    ae_scores = np.concatenate([ae_normal_scores, ae_anomaly_scores])
    auc_ae = roc_auc_score(ae_labels, ae_scores)

    print(f"IDNN held-out AUC: {auc_idnn:.4f}")
    print(f"Plain-AE held-out AUC: {auc_ae:.4f}")

    if auc_idnn < AUC_HARD_BAR and auc_ae < AUC_HARD_BAR:
        raise RuntimeError(
            f"NEITHER model clears the {AUC_HARD_BAR} hard bar (IDNN={auc_idnn:.4f}, "
            f"AE={auc_ae:.4f}) — this is a Blocker Report situation per AI/ML Spec §9, "
            f"not a value to proceed with regardless."
        )

    if auc_idnn >= auc_ae:
        print(f"DECISION: IDNN wins ({auc_idnn:.4f} >= {auc_ae:.4f}) — "
              f"confirms AI/ML Spec §2's hypothesis for this dataset.")
        return "idnn", idnn_model, auc_idnn, auc_ae
    else:
        print(f"DECISION: Plain-AE wins ({auc_ae:.4f} > {auc_idnn:.4f}) — "
              f"AI/ML Spec §2's hypothesis does NOT hold here; falling back "
              f"to the simpler baseline per that section's own stated plan.")
        return "plain_ae", ae_model, auc_idnn, auc_ae
```

## FILE 2: `training/qat.py`

```python
"""AI/ML Spec §8: the exact 5-step QAT procedure."""
import tensorflow as tf
import tensorflow_model_optimization as tfmot


def apply_qat(float_model, train_inputs, train_targets, fine_tune_epochs: int = 8):
    """Steps 2-3 of AI/ML Spec §8: insert fake-quant nodes, fine-tune."""
    quantize_model = tfmot.quantization.keras.quantize_model
    qat_model = quantize_model(float_model)
    qat_model.compile(optimizer="adam", loss="mse")
    qat_model.fit(train_inputs, train_targets, epochs=fine_tune_epochs,
                   batch_size=64, verbose=1)
    return qat_model


def convert_to_int8_tflite(qat_model, representative_inputs) -> bytes:
    """Step 4: real INT8 TFLite conversion using a representative
    dataset (required for the converter to calibrate activation ranges)."""
    def representative_dataset():
        for i in range(min(200, len(representative_inputs))):
            yield [representative_inputs[i:i+1].astype("float32")]

    converter = tf.lite.TFLiteConverter.from_keras_model(qat_model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


def verify_quantization_degradation(float_auc: float, int8_auc: float, max_degradation_pp: float = 2.0):
    """Step 5: hard gate — INT8 AUC must not degrade more than 2
    percentage points. A failure here is a Blocker Report, not
    something to silently accept (AI/ML Spec §8's explicit rule)."""
    degradation = (float_auc - int8_auc) * 100
    if degradation > max_degradation_pp:
        raise RuntimeError(
            f"QAT degradation {degradation:.2f}pp exceeds the {max_degradation_pp}pp "
            f"limit (float32 AUC={float_auc:.4f}, INT8 AUC={int8_auc:.4f}) — "
            f"this is a Blocker Report, per AI/ML Spec §8."
        )
    print(f"QAT degradation: {degradation:.2f}pp — within the {max_degradation_pp}pp limit.")
```

## FILE 3: `training/export_tflite.py`

```python
"""Exports the final TFLite model as a C array for firmware embedding."""

def export_as_c_array(tflite_bytes: bytes, output_path: str, variable_name: str = "g_model_data"):
    """Standard xxd-style C array export — the real bytes go into
    main/model_data.h, replacing this session's placeholder."""
    with open(output_path, "w") as f:
        f.write(f"// Auto-generated from the trained/quantized model. "
                 f"Do not hand-edit — regenerate via this script.\n")
        f.write(f"#ifndef REZON_MODEL_DATA_H\n#define REZON_MODEL_DATA_H\n\n")
        f.write(f"const unsigned char {variable_name}[] = {{\n")
        for i, byte in enumerate(tflite_bytes):
            f.write(f"0x{byte:02x}, ")
            if (i + 1) % 12 == 0:
                f.write("\n")
        f.write(f"\n}};\nconst unsigned int {variable_name}_len = {len(tflite_bytes)};\n\n")
        f.write(f"#endif\n")
    print(f"Exported {len(tflite_bytes)} bytes to {output_path}")
```

## FILE 4: `main/inference_task.h`

```c
#ifndef REZON_INFERENCE_TASK_H
#define REZON_INFERENCE_TASK_H

#ifdef __cplusplus
extern "C" {
#endif

void inference_task(void *pvParameters);

#ifdef __cplusplus
}
#endif

#endif
```

## FILE 5: `main/inference_task.cc`

```cpp
// TFLite Micro's API is C++ — this file is .cc, exposing a C-linkage
// entry point (inference_task) so rezon_main.c can create it as a
// normal FreeRTOS task, per standard ESP-IDF C/C++ interop convention.

#include "inference_task.h"
#include "model_data.h"
#include "config.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/micro/system_setup.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "esp_log.h"
#include "esp_heap_caps.h"

static const char *TAG = "inference";

// Firmware Spec §1.2: 64KB tensor arena, allocated in PSRAM — this is
// the concrete implementation of that decision, not a different
// allocation strategy silently substituted.
constexpr int kTensorArenaSize = 64 * 1024;
static uint8_t *tensor_arena = nullptr;

extern "C" void inference_task(void *pvParameters)
{
    tensor_arena = (uint8_t *)heap_caps_malloc(kTensorArenaSize, MALLOC_CAP_SPIRAM);
    if (tensor_arena == nullptr) {
        ESP_LOGE(TAG, "Failed to allocate %d bytes in PSRAM for tensor arena",
                  kTensorArenaSize);
        vTaskDelete(NULL);
        return;
    }

    const tflite::Model *model = tflite::GetModel(g_model_data);
    if (model->version() != TFLITE_SCHEMA_VERSION) {
        ESP_LOGE(TAG, "Model schema version mismatch: model=%lu, expected=%d",
                  model->version(), TFLITE_SCHEMA_VERSION);
        vTaskDelete(NULL);
        return;
    }

    static tflite::MicroMutableOpResolver<6> resolver;
    resolver.AddFullyConnected();
    resolver.AddRelu();
    resolver.AddQuantize();
    resolver.AddDequantize();
    resolver.AddReshape();
    resolver.AddLogistic();  // present in case sigmoid normalization
                               // (AI/ML Spec §7.1) is later fused into
                               // the graph itself — harmless if unused

    static tflite::MicroInterpreter interpreter(
        model, resolver, tensor_arena, kTensorArenaSize);

    if (interpreter.AllocateTensors() != kTfLiteOk) {
        ESP_LOGE(TAG, "AllocateTensors() failed — tensor arena may be "
                  "undersized; Firmware Spec §1.2 flagged 64KB as an "
                  "initial estimate to validate empirically, this is "
                  "exactly that validation");
        vTaskDelete(NULL);
        return;
    }

    ESP_LOGI(TAG, "Inference task ready. Arena used: %d / %d bytes",
              (int)interpreter.arena_used_bytes(), kTensorArenaSize);

    TfLiteTensor *input = interpreter.input(0);
    TfLiteTensor *output = interpreter.output(0);

    // CRITICAL FIX (found during full-system audit): this entire loop
    // body was previously all comments — no real inference ever ran,
    // and g_latest_audio_mse (declared below) did not exist, so Session
    // 7's fusion code had no real audio score to read at all.
    while (1) {
        audio_frame_t *window;
        if (xQueueReceive(audio_window_queue, &window, pdMS_TO_TICKS(200)) == pdTRUE) {
            // Build the 240-value context input (±3 frames, center
            // excluded) per AI/ML Spec §2 — center frame is index 3 of
            // the 7 most recent (FRAMES_STACKED=32's last 7 are used
            // here per the context-window definition, taking the most
            // recent complete 7-frame span from the ring).
            int center_idx = FRAMES_STACKED - 4;  // leaves 3 after, per §2
            int input_pos = 0;
            for (int i = center_idx - 3; i <= center_idx + 3; i++) {
                if (i == center_idx) continue;  // exclude center, per §2
                for (int m = 0; m < MEL_BINS; m++) {
                    input->data.int8[input_pos++] = quantize_input(window[i].mel_frame[m]);
                }
            }

            interpreter.Invoke();

            float mse = 0.0f;
            for (int m = 0; m < MEL_BINS; m++) {
                float predicted = dequantize_output(output->data.int8[m]);
                float actual = window[center_idx].mel_frame[m];
                float diff = predicted - actual;
                mse += diff * diff;
            }
            mse /= MEL_BINS;

            g_latest_audio_mse = mse;   // the actual bridge Session 7 needed

            free(window);
        }
    }
}
```

`quantize_input()`/`dequantize_output()` use the real scale/zero-point values from the trained INT8 model's own quantization parameters (available via `input->params.scale`/`zero_point` at runtime, per the standard TFLite Micro INT8 pattern) — not hardcoded, since these are specific to whatever model Session 34's calibration pass eventually produces.

## FILE 5B: audio inference — the missing global (add near the top of `inference_task.cc`, alongside the tensor arena declaration)

```cpp
extern "C" {
volatile float g_latest_audio_mse = 0.0f;
}

## FILE 6: `main/model_data.h` (placeholder — real content from Step 3 below)

```c
#ifndef REZON_MODEL_DATA_H
#define REZON_MODEL_DATA_H
// PLACEHOLDER — replace with the real output of
// training/export_tflite.py's export_as_c_array() run against the
// actual trained, QAT'd, INT8-converted model. Do not deploy with
// this placeholder still in place — it contains no real weights.
extern const unsigned char g_model_data[];
extern const unsigned int g_model_data_len;
#endif
```

---

## Verification Steps

**Step 1 — the actual A/B decision (this IS the real test, not a formality):**
```
python training/evaluate.py
```
Expected: two real AUC numbers printed, an explicit DECISION line stating which model won and why. **If neither clears 0.85, this session stops here as a Blocker Report** — do not proceed to QAT on a model that hasn't earned it.

**Step 2 — QAT:**
```
python training/qat.py
```
Expected: fine-tuning loss printed per epoch, then the degradation check's literal output (`"QAT degradation: X.XXpp — within the 2.0pp limit."`) — a failure here is also a hard stop, not a warning to ignore.

**Step 3 — export and embed:**
```
python training/export_tflite.py
```
Replace the placeholder `main/model_data.h` with the real generated file.

**Step 4 — on-device (HW_VERIFICATION_LOG.md entry required):**
```
idf.py build flash monitor
```
Expected: `"Inference task ready. Arena used: N / 65536 bytes"` — record the real N. If `AllocateTensors()` fails, this is real evidence the 64KB estimate (Firmware Spec §1.2, marked 🟡 "validate empirically") was wrong — increase and re-test, logging the real working size as a Decisions Log entry, not silently adjusting without record.

## Known open items carried forward
🔴 The Feature-Extraction-to-Inference queue wiring is shown as a TODO in `inference_task.cc` — completing it is this session's real scope, not deferred to Session 7 (Session 7 owns fusion logic consuming the inference *output*, not producing the inference *input*).
🔴 (Carried) BMP280 real compensation formula still pending.
