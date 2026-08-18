# SESSION 04 — Feature Extraction Task
**Risk tier: HIGH-RISK (mandatory safety-relevant filtering + hardware-dependent validation). Requires physical verification.**
**Branch: `session/build-04-feature-extraction`**
**Attach: `specs/technical/01_AI_ML_TECHNICAL_SPEC.md` §1-6, `specs/technical/02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §1, `specs/sessions/SESSION_03_rtos_skeleton_and_acquisition.md`**

---

## Agent Instructions

Implement the real Feature Extraction Task, replacing Session 3's stub. This is a **retrofit session** on `acquisition_task.c` (wiring real queues where Session 3 left TODOs) plus new feature-computation modules. Every algorithm here comes directly from the AI/ML Spec — do not invent scoring logic not present in that document.

**What this session creates/modifies:**
- `main/shared_queues.h` / `.c` — NEW: queue definitions connecting acquisition → feature extraction
- `main/acquisition_task.c` — MODIFIED: replace Session 3's TODOs with real queue sends
- `main/feature_extraction_task.c` / `.h` — NEW: the real task
- `main/features/rolling_stats.c` / `.h` — NEW: shared streaming mean/variance (Welford's algorithm)
- `main/features/audio_features.c` / `.h` — NEW: log-mel spectrogram
- `main/features/vibration_features.c` / `.h` — NEW: 3-band FFT energy + max-deviation
- `main/features/environment_features.c` / `.h` — NEW: 3-param max-deviation
- `main/features/gas_features.c` / `.h` — NEW: MQ135 compensation
- `main/features/current_features.c` / `.h` — NEW: ACS712 EMA filter

## Retrofit check (per METHODOLOGY.md — do this before editing acquisition_task.c)

Read the real, current `acquisition_task.c` from Session 3. Confirm it contains the exact TODO comments this session assumes (`// TODO Session 4: push audio_buf into the feature-extraction queue` and the equivalent for vibration). If the real file doesn't match — STOP, report the discrepancy, do not silently adapt.

---

## FILE 1: `main/shared_queues.h`

```c
#ifndef REZON_SHARED_QUEUES_H
#define REZON_SHARED_QUEUES_H
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

// Queue depths of 2-3 per METHODOLOGY.md's own general RTOS guidance
// (absorb normal jitter, but a backed-up queue should be immediately
// visible as a real problem, not silently buffer forever).
#define AUDIO_QUEUE_DEPTH  3
#define VIBRATION_QUEUE_DEPTH 3
#define AUDIO_WINDOW_QUEUE_DEPTH 2   // CRITICAL FIX addition — see FILE 13

extern QueueHandle_t audio_raw_queue;       // holds pointers to heap-allocated int32_t buffers
extern QueueHandle_t vibration_raw_queue;   // holds mpu6050_reading_t by value
extern QueueHandle_t audio_window_queue;    // holds pointers to heap-allocated
                                              // audio_frame_t[FRAMES_STACKED]
                                              // arrays — the Session 4-to-
                                              // Session 6 bridge that was
                                              // missing entirely before this fix

// CRITICAL FIX (moved here during full-system audit): this type was
// originally only defined locally inside Session 8's networking_task.c,
// meaning Session 7's output_task.c — which needs to construct one every
// cycle — could not actually reference it. Shared here since both files
// need it, same reasoning as every other cross-task type in this header.
typedef struct {
    fusion_result_t fusion;
    char event_type[32];  // "" if no event, else "alert"|"actuation"|"suppressed_..."
    char contributing_modalities_json[256];
} telemetry_submission_t;
extern QueueHandle_t telemetry_submit_queue;  // holds pointers to heap-allocated
                                                 // telemetry_submission_t —
                                                 // written by output_task.c
                                                 // (Session 7), consumed by
                                                 // networking_task.c (Session 8)

void shared_queues_init(void);

#endif
```

## FILE 2: `main/shared_queues.c`

```c
#include "shared_queues.h"

QueueHandle_t audio_raw_queue = NULL;
QueueHandle_t vibration_raw_queue = NULL;
QueueHandle_t audio_window_queue = NULL;
QueueHandle_t telemetry_submit_queue = NULL;

void shared_queues_init(void)
{
    audio_raw_queue = xQueueCreate(AUDIO_QUEUE_DEPTH, sizeof(int32_t *));
    vibration_raw_queue = xQueueCreate(VIBRATION_QUEUE_DEPTH, sizeof(mpu6050_reading_t));
    audio_window_queue = xQueueCreate(AUDIO_WINDOW_QUEUE_DEPTH, sizeof(audio_frame_t *));
    telemetry_submit_queue = xQueueCreate(3, sizeof(telemetry_submission_t *));
}
```

## FILE 3: `main/features/rolling_stats.h`

```c
#ifndef REZON_ROLLING_STATS_H
#define REZON_ROLLING_STATS_H

// Welford's online algorithm — numerically stable streaming mean/variance,
// used identically by vibration (per-band), environment (per-parameter),
// gas, and current scoring (AI/ML Spec §3-7's shared "rolling μ/σ" pattern).
typedef struct {
    double mean;
    double m2;        // sum of squared deviations from the mean
    uint32_t count;
} rolling_stats_t;

void rolling_stats_init(rolling_stats_t *s);
void rolling_stats_update(rolling_stats_t *s, double new_value);
double rolling_stats_stddev(const rolling_stats_t *s);
// z-score of `value` against this stat's current mean/stddev. Returns
// 0.0 if count < 2 (not enough history yet — avoids divide-by-zero,
// and a 0 z-score is the correct "no information yet" default).
double rolling_stats_zscore(const rolling_stats_t *s, double value);

#endif
```

## FILE 4: `main/features/rolling_stats.c`

```c
#include "rolling_stats.h"
#include <math.h>

void rolling_stats_init(rolling_stats_t *s)
{
    s->mean = 0.0;
    s->m2 = 0.0;
    s->count = 0;
}

void rolling_stats_update(rolling_stats_t *s, double new_value)
{
    s->count++;
    double delta = new_value - s->mean;
    s->mean += delta / s->count;
    double delta2 = new_value - s->mean;
    s->m2 += delta * delta2;
}

double rolling_stats_stddev(const rolling_stats_t *s)
{
    if (s->count < 2) return 0.0;
    return sqrt(s->m2 / (s->count - 1));
}

double rolling_stats_zscore(const rolling_stats_t *s, double value)
{
    if (s->count < 2) return 0.0;
    double sd = rolling_stats_stddev(s);
    if (sd < 1e-9) return 0.0;  // avoid divide-by-near-zero on a
                                 // perfectly flat early history
    return (value - s->mean) / sd;
}
```

## FILE 5: `main/features/audio_features.h`

```c
#ifndef REZON_AUDIO_FEATURES_H
#define REZON_AUDIO_FEATURES_H
#include <stdint.h>

#define MEL_BINS 40
#define FRAMES_STACKED 32

typedef struct {
    float mel_frame[MEL_BINS];   // one frame's worth of log-mel energies
} audio_frame_t;

// Processes one raw PCM buffer (from the I2S DMA read, Session 3) into
// one log-mel frame. Internally: Hann window -> FFT -> power spectrum
// -> mel filterbank -> log compression. AI/ML Spec §1: 16kHz, 1024-
// sample window, 512 hop, 40 mel bins.
void audio_features_init(void);
void audio_features_compute_frame(const int32_t *raw_pcm, size_t sample_count,
                                    audio_frame_t *out_frame);

#endif
```

## FILE 6: `main/features/audio_features.c`

```c
#include "audio_features.h"
#include "esp_dsp.h"
#include "esp_log.h"
#include <math.h>
#include <string.h>

static const char *TAG = "audio_features";
#define FFT_SIZE 1024

static float hann_window[FFT_SIZE];
static float fft_buf[FFT_SIZE * 2];  // interleaved real/imag for dsps_fft2r_fc32
static float mel_filterbank[MEL_BINS][FFT_SIZE / 2 + 1];  // precomputed

// Precompute a triangular mel filterbank spanning 0-8000Hz (Nyquist for
// 16kHz sampling) into MEL_BINS triangular filters — standard mel-scale
// construction (Hz -> mel: 2595*log10(1+f/700)).
static void build_mel_filterbank(void)
{
    float mel_min = 0.0f;
    float mel_max = 2595.0f * log10f(1.0f + 8000.0f / 700.0f);
    float mel_points[MEL_BINS + 2];
    for (int i = 0; i < MEL_BINS + 2; i++) {
        mel_points[i] = mel_min + (mel_max - mel_min) * i / (MEL_BINS + 1);
    }
    float hz_points[MEL_BINS + 2];
    for (int i = 0; i < MEL_BINS + 2; i++) {
        hz_points[i] = 700.0f * (powf(10.0f, mel_points[i] / 2595.0f) - 1.0f);
    }
    int bin_points[MEL_BINS + 2];
    for (int i = 0; i < MEL_BINS + 2; i++) {
        bin_points[i] = (int)floorf((FFT_SIZE + 1) * hz_points[i] / 16000.0f);
    }

    memset(mel_filterbank, 0, sizeof(mel_filterbank));
    for (int m = 1; m <= MEL_BINS; m++) {
        for (int k = bin_points[m - 1]; k < bin_points[m]; k++) {
            if (k >= 0 && k <= FFT_SIZE / 2)
                mel_filterbank[m - 1][k] = (float)(k - bin_points[m - 1]) /
                                             (bin_points[m] - bin_points[m - 1]);
        }
        for (int k = bin_points[m]; k < bin_points[m + 1]; k++) {
            if (k >= 0 && k <= FFT_SIZE / 2)
                mel_filterbank[m - 1][k] = (float)(bin_points[m + 1] - k) /
                                             (bin_points[m + 1] - bin_points[m]);
        }
    }
}

void audio_features_init(void)
{
    dsps_fft2r_init_fc32(NULL, FFT_SIZE);
    dsps_wind_hann_f32(hann_window, FFT_SIZE);
    build_mel_filterbank();
    ESP_LOGI(TAG, "Audio feature extraction initialized: %d mel bins, FFT size %d",
              MEL_BINS, FFT_SIZE);
}

void audio_features_compute_frame(const int32_t *raw_pcm, size_t sample_count,
                                    audio_frame_t *out_frame)
{
    size_t n = sample_count < FFT_SIZE ? sample_count : FFT_SIZE;

    // Convert 32-bit I2S samples (24-bit data, left-justified) to
    // normalized float, apply Hann window, load into interleaved
    // real/imag FFT buffer (imag = 0 for real input).
    for (size_t i = 0; i < n; i++) {
        float sample = (float)(raw_pcm[i] >> 8) / 8388608.0f;  // 24-bit -> [-1,1]
        fft_buf[2 * i] = sample * hann_window[i];
        fft_buf[2 * i + 1] = 0.0f;
    }
    for (size_t i = n; i < FFT_SIZE; i++) {  // zero-pad if buffer was short
        fft_buf[2 * i] = 0.0f;
        fft_buf[2 * i + 1] = 0.0f;
    }

    dsps_fft2r_fc32(fft_buf, FFT_SIZE);
    dsps_bit_rev2r_fc32(fft_buf, FFT_SIZE);

    float power_spectrum[FFT_SIZE / 2 + 1];
    for (int k = 0; k <= FFT_SIZE / 2; k++) {
        float re = fft_buf[2 * k];
        float im = fft_buf[2 * k + 1];
        power_spectrum[k] = re * re + im * im;
    }

    for (int m = 0; m < MEL_BINS; m++) {
        float energy = 0.0f;
        for (int k = 0; k <= FFT_SIZE / 2; k++) {
            energy += power_spectrum[k] * mel_filterbank[m][k];
        }
        out_frame->mel_frame[m] = logf(energy + 1e-6f);  // log compression, epsilon avoids log(0)
    }
}
```

## FILE 7: `main/features/vibration_features.h`

```c
#ifndef REZON_VIBRATION_FEATURES_H
#define REZON_VIBRATION_FEATURES_H
#include "drivers/i2c_bus.h"
#include <stdbool.h>

// Feeds one accelerometer sample into the 250-sample (1s @ 250Hz)
// analysis window. Returns true and writes *out_deviation when a full
// window completes and a new deviation score is ready (per AI/ML
// Spec §3 — analysis cadence every 1s); false otherwise (still filling).
bool vibration_features_update(const mpu6050_reading_t *sample, double *out_deviation);

#endif
```

## FILE 8: `main/features/vibration_features.c`

```c
#include "vibration_features.h"
#include "rolling_stats.h"
#include "esp_dsp.h"
#include <math.h>
#include <string.h>

#define WINDOW_SIZE 250   // 1s @ 250Hz per AI/ML Spec §3
// NOTE: AI/ML Spec §3 states FFT window = 128 samples (0.64s) for band
// resolution, while the analysis cadence is 1s. This implementation
// buffers a full 1s (250 samples) of magnitude, then runs the 128-point
// FFT on the most recent 128 samples of that buffer each cadence tick —
// reconciling the two stated parameters (250Hz collection window vs
// 128-sample FFT) the way the spec implies but doesn't spell out
// mechanically. Flagged here for visibility, not silently assumed.
#define FFT_WINDOW 128

static float magnitude_buf[WINDOW_SIZE];
static int buf_index = 0;
static rolling_stats_t band_low_stats, band_mid_stats, band_high_stats;
static bool stats_initialized = false;

static void compute_band_energies(float *out_low, float *out_mid, float *out_high)
{
    float fft_buf[FFT_WINDOW * 2];
    // Use the most recent FFT_WINDOW samples from the circular magnitude_buf
    int start = (buf_index - FFT_WINDOW + WINDOW_SIZE) % WINDOW_SIZE;
    for (int i = 0; i < FFT_WINDOW; i++) {
        int idx = (start + i) % WINDOW_SIZE;
        fft_buf[2 * i] = magnitude_buf[idx];
        fft_buf[2 * i + 1] = 0.0f;
    }

    dsps_fft2r_fc32(fft_buf, FFT_WINDOW);
    dsps_bit_rev2r_fc32(fft_buf, FFT_WINDOW);

    // Bin resolution at 250Hz sampling, 128-point FFT: 250/128 ≈ 1.95 Hz/bin
    float bin_hz = 250.0f / FFT_WINDOW;
    *out_low = 0; *out_mid = 0; *out_high = 0;
    for (int k = 1; k <= FFT_WINDOW / 2; k++) {  // skip DC (k=0)
        float freq = k * bin_hz;
        float re = fft_buf[2 * k], im = fft_buf[2 * k + 1];
        float energy = re * re + im * im;
        if (freq < 10.0f) *out_low += energy;
        else if (freq < 50.0f) *out_mid += energy;
        else if (freq < 100.0f) *out_high += energy;
    }
}

bool vibration_features_update(const mpu6050_reading_t *sample, double *out_deviation)
{
    if (!stats_initialized) {
        rolling_stats_init(&band_low_stats);
        rolling_stats_init(&band_mid_stats);
        rolling_stats_init(&band_high_stats);
        stats_initialized = true;
    }

    float mag = sqrtf(sample->accel_x_g * sample->accel_x_g +
                        sample->accel_y_g * sample->accel_y_g +
                        sample->accel_z_g * sample->accel_z_g);
    magnitude_buf[buf_index] = mag;
    buf_index = (buf_index + 1) % WINDOW_SIZE;

    // Only compute a new deviation score once per WINDOW_SIZE samples
    // (the "every 1s" cadence from AI/ML Spec §3), not every single sample.
    static int samples_since_last_compute = 0;
    samples_since_last_compute++;
    if (samples_since_last_compute < WINDOW_SIZE) return false;
    samples_since_last_compute = 0;

    float low, mid, high;
    compute_band_energies(&low, &mid, &high);

    rolling_stats_update(&band_low_stats, low);
    rolling_stats_update(&band_mid_stats, mid);
    rolling_stats_update(&band_high_stats, high);

    double z_low = rolling_stats_zscore(&band_low_stats, low);
    double z_mid = rolling_stats_zscore(&band_mid_stats, mid);
    double z_high = rolling_stats_zscore(&band_high_stats, high);

    // AI/ML Spec §3: max deviation across the 3 bands, not the average
    // (DEC-025's now-explicit formula)
    double max_z = fabs(z_low);
    if (fabs(z_mid) > max_z) max_z = fabs(z_mid);
    if (fabs(z_high) > max_z) max_z = fabs(z_high);

    *out_deviation = max_z;
    return true;
}
```

## FILE 9: `main/features/environment_features.h` / `.c`

```c
#ifndef REZON_ENVIRONMENT_FEATURES_H
#define REZON_ENVIRONMENT_FEATURES_H
#include <stdbool.h>

// AI/ML Spec §6: max deviation across temp/humidity/pressure, same
// pattern as vibration's bands (DEC-017's original fix, DEC-025's
// vibration formula made consistent with it).
double environment_features_update(float temp_c, float humidity_pct, float pressure_hpa);

#endif
```

```c
#include "environment_features.h"
#include "rolling_stats.h"
#include <math.h>

static rolling_stats_t temp_stats, humidity_stats, pressure_stats;
static bool initialized = false;

double environment_features_update(float temp_c, float humidity_pct, float pressure_hpa)
{
    if (!initialized) {
        rolling_stats_init(&temp_stats);
        rolling_stats_init(&humidity_stats);
        rolling_stats_init(&pressure_stats);
        initialized = true;
    }

    rolling_stats_update(&temp_stats, temp_c);
    rolling_stats_update(&humidity_stats, humidity_pct);
    rolling_stats_update(&pressure_stats, pressure_hpa);

    double z_temp = rolling_stats_zscore(&temp_stats, temp_c);
    double z_humidity = rolling_stats_zscore(&humidity_stats, humidity_pct);
    double z_pressure = rolling_stats_zscore(&pressure_stats, pressure_hpa);

    double max_z = fabs(z_temp);
    if (fabs(z_humidity) > max_z) max_z = fabs(z_humidity);
    if (fabs(z_pressure) > max_z) max_z = fabs(z_pressure);
    return max_z;
}
```

## FILE 10: `main/features/gas_features.h` / `.c`

```c
#ifndef REZON_GAS_FEATURES_H
#define REZON_GAS_FEATURES_H

// AI/ML Spec §4: linear compensation, coefficients start at 0 (not
// borrowed generic constants — DEC-005's reconciliation), fit during
// burn-in (Session 34, out of this session's scope). Returns the
// compensated reading; scoring against a rolling baseline happens in
// the Inference & Fusion Task (Session 7), not here — this function's
// job ends at producing a trustworthy compensated VALUE.
float gas_features_compensate(int raw_mv, float temp_c, float humidity_pct);

// Burn-in-fitted coefficients — 0.0 until Session 34 replaces them via
// the calibration pass. Exposed so that session can set them.
extern float gas_k_temp;
extern float gas_k_humidity;
extern const float GAS_T_REF;
extern const float GAS_H_REF;

#endif
```

```c
#include "gas_features.h"

float gas_k_temp = 0.0f;       // fit during burn-in, AI/ML Spec §4
float gas_k_humidity = 0.0f;   // fit during burn-in
const float GAS_T_REF = 20.0f;
const float GAS_H_REF = 65.0f;

float gas_features_compensate(int raw_mv, float temp_c, float humidity_pct)
{
    float correction = 1.0f + gas_k_temp * (temp_c - GAS_T_REF)
                             + gas_k_humidity * (humidity_pct - GAS_H_REF);
    return raw_mv * correction;
}
```

## FILE 11: `main/features/current_features.h` / `.c`

```c
#ifndef REZON_CURRENT_FEATURES_H
#define REZON_CURRENT_FEATURES_H

// AI/ML Spec §5 (reconciled version, DEC-005): single-stage EMA, alpha=0.2
float current_features_filter(int raw_mv);

#endif
```

```c
#include "current_features.h"

#define ACS712_EMA_ALPHA 0.2f
static float ema_state = 0.0f;
static int initialized = 0;

float current_features_filter(int raw_mv)
{
    if (!initialized) {
        ema_state = (float)raw_mv;  // seed with first real reading, not 0 —
                                      // avoids a slow ramp-up bias on boot
        initialized = 1;
    } else {
        ema_state = ACS712_EMA_ALPHA * raw_mv + (1.0f - ACS712_EMA_ALPHA) * ema_state;
    }
    return ema_state;
}
```

## FILE 12: `main/acquisition_task.c` — RETROFIT (Session 3's TODOs replaced)

```c
// ... (unchanged init code from Session 3 — omitted here for brevity,
// NOT omitted in the real file; this block shows only the two lines
// that actually change) ...

// REPLACES: "// TODO Session 4: push audio_buf into the feature-extraction queue"
int32_t *audio_buf_copy = malloc(sizeof(audio_buf));
memcpy(audio_buf_copy, audio_buf, sizeof(audio_buf));
if (xQueueSend(audio_raw_queue, &audio_buf_copy, 0) != pdTRUE) {
    free(audio_buf_copy);  // queue full — feature extraction is falling
                             // behind; drop this buffer rather than block
                             // acquisition (protecting audio sampling
                             // integrity takes priority, per Firmware §1)
}

// REPLACES: "// TODO Session 4: push into vibration feature-extraction queue"
xQueueSend(vibration_raw_queue, &vib, 0);  // same drop-if-full policy
```

## FILE 13: `main/feature_extraction_task.c`

```c
#include "feature_extraction_task.h"
#include "shared_queues.h"
#include "features/audio_features.h"
#include "features/vibration_features.h"
#include "features/environment_features.h"
#include "features/gas_features.h"
#include "features/current_features.h"
#include "config.h"
#include "esp_log.h"

static const char *TAG = "feature_extraction";

// CRITICAL FIX (found during full-system audit, post-Session-37): these
// globals did not exist anywhere until this fix. Session 7's fusion code
// was written assuming they existed — g_latest_compensated_gas and
// g_latest_filtered_current specifically were referenced by name in
// Session 7 without ever being declared here, meaning that code would
// not even compile as originally written, and vibration/environment's
// real computed values were being silently discarded rather than made
// available to fusion at all. This is the actual real-time bridge
// between this task's per-modality computations and the Inference &
// Fusion Task (Session 7) that consumes them every cycle.
volatile double g_latest_vibration_deviation = 0.0;
volatile double g_latest_environment_deviation = 0.0;
volatile float g_latest_compensated_gas = 0.0;
volatile float g_latest_filtered_current = 0.0;

// CRITICAL FIX: this queue is the actual Session-4-to-Session-6 bridge
// that was never created — declared here since Session 4 is the
// producer; consumed by Session 6/7's inference_task.cc.
QueueHandle_t audio_window_queue;  // created in shared_queues_init() —
                                      // FILE 1/2 of this session updated
                                      // to include it, size 2, holding
                                      // audio_frame_t[FRAMES_STACKED]* pointers

void feature_extraction_task(void *pvParameters)
{
    audio_features_init();
    ESP_LOGI(TAG, "Feature extraction task started");
    static audio_frame_t frame_ring[FRAMES_STACKED];
    static int frame_ring_index = 0;

    while (1) {
        int32_t *audio_buf;
        if (xQueueReceive(audio_raw_queue, &audio_buf, pdMS_TO_TICKS(100)) == pdTRUE) {
            audio_features_compute_frame(audio_buf, AUDIO_DMA_BUF_LEN,
                                           &frame_ring[frame_ring_index]);
            frame_ring_index = (frame_ring_index + 1) % FRAMES_STACKED;
            free(audio_buf);

            // CRITICAL FIX (found during full-system audit): this queue
            // never existed before — Session 6's inference task had
            // nowhere real to receive stacked frames from, and this
            // push was only ever a comment ("TODO Session 6..."), never
            // real code. Push a snapshot of the current ring once full.
            if (frame_ring_index == 0) {  // wrapped = FRAMES_STACKED collected
                audio_frame_t *window_copy = malloc(sizeof(frame_ring));
                memcpy(window_copy, frame_ring, sizeof(frame_ring));
                if (xQueueSend(audio_window_queue, &window_copy, 0) != pdTRUE) {
                    free(window_copy);  // inference falling behind — drop,
                                          // same policy as the raw audio queue
                }
            }
        }

        mpu6050_reading_t vib_sample;
        if (xQueueReceive(vibration_raw_queue, &vib_sample, 0) == pdTRUE) {
            double vib_deviation;
            if (vibration_features_update(&vib_sample, &vib_deviation)) {
                g_latest_vibration_deviation = vib_deviation;   // CRITICAL FIX
                                                                   // (found during
                                                                   // full-system audit):
                                                                   // this value was
                                                                   // computed and
                                                                   // immediately
                                                                   // discarded before —
                                                                   // Session 7 needed
                                                                   // it and had nowhere
                                                                   // real to read it from
            }
        }

        // Environment, gas, current: read on their own slow cadences in
        // the Acquisition Task (Session 3), scored here via direct
        // function calls rather than a queue — these rates (2.5s/1s/10ms)
        // are slow enough relative to this task's loop that a queue would
        // add complexity with no real benefit, unlike audio/vibration's
        // continuous high-rate streams.
        //
        // This requires acquisition_task.c to additionally call these
        // three functions at its own read points and forward the results
        // — completing that wiring is part of THIS session, done here:

        extern volatile float g_latest_env_temp, g_latest_env_humidity, g_latest_env_pressure;
        extern volatile int g_latest_mq135_raw_mv, g_latest_acs712_raw_mv;
        extern volatile bool g_env_reading_available, g_gas_reading_available, g_current_reading_available;

        if (g_env_reading_available) {
            double env_deviation = environment_features_update(
                g_latest_env_temp, g_latest_env_humidity, g_latest_env_pressure);
            g_latest_environment_deviation = env_deviation;   // CRITICAL FIX (same
                                                                  // class as vibration
                                                                  // above — computed,
                                                                  // then previously
                                                                  // discarded)
            g_env_reading_available = false;
        }
        if (g_gas_reading_available) {
            float compensated = gas_features_compensate(
                g_latest_mq135_raw_mv, g_latest_env_temp, g_latest_env_humidity);
            g_latest_compensated_gas = compensated;   // CRITICAL FIX — this exact
                                                          // variable name was assumed
                                                          // to exist by Session 7's
                                                          // FILE 7A but was NEVER
                                                          // actually declared anywhere
                                                          // until this line
            g_gas_reading_available = false;
        }
        if (g_current_reading_available) {
            float filtered = current_features_filter(g_latest_acs712_raw_mv);
            g_latest_filtered_current = filtered;   // CRITICAL FIX — same class
            g_current_reading_available = false;
        }

        vTaskDelay(pdMS_TO_TICKS(10));  // this task doesn't need to spin
                                          // as fast as acquisition — 10ms
                                          // is well under every relevant
                                          // cadence above
    }
}
```

## FILE 14: `main/acquisition_task.c` — RETROFIT part 2 (the shared globals FILE 13 reads)

```c
// Added to acquisition_task.c: simple volatile-flagged globals connecting
// acquisition's slow-cadence reads to feature_extraction_task's scoring
// calls above. A mutex-free volatile-flag handoff is sufficient here —
// these are single-producer/single-consumer, non-time-critical values,
// unlike the audio/vibration queues which need real queue semantics.

volatile float g_latest_env_temp, g_latest_env_humidity, g_latest_env_pressure;
volatile int g_latest_mq135_raw_mv, g_latest_acs712_raw_mv;
volatile bool g_env_reading_available = false;
volatile bool g_gas_reading_available = false;
volatile bool g_current_reading_available = false;

// Inside acquisition_task's DHT22 block (extends Session 3's code):
//   if (dht22_read(&env) == ESP_OK) {
//       g_latest_env_temp = env.temperature_c;
//       g_latest_env_humidity = env.humidity_pct;
//       g_env_reading_available = true;
//   }
// Inside the BMP280 block: g_latest_env_pressure = press.pressure_hpa;
// Inside the MQ135 block:
//   g_latest_mq135_raw_mv = mq135_mv; g_gas_reading_available = true;
// Inside the ACS712 block (every cycle):
//   g_latest_acs712_raw_mv = acs712_mv; g_current_reading_available = true;
```

---

## Verification Steps

**Step 1 — build:** `idf.py build` — expected: succeeds, zero errors.

**Step 2 — unit tests (host-side, Unity):**
- `rolling_stats`: feed a known sequence (e.g., 1,2,3,4,5), confirm computed mean=3.0, stddev matches hand-calculated sample stddev (≈1.58) — literal expected values, not "reasonable."
- `vibration_features`: feed a synthetic magnitude sequence with an injected known-frequency spike in the "mid" band, confirm `compute_band_energies` shows mid > low and mid > high for that window.
- `gas_features_compensate`: with k_temp=k_humidity=0 (pre-burn-in default), confirm output == input exactly (correction factor = 1.0).
- `current_features_filter`: feed a step input, confirm the EMA output approaches but doesn't instantly jump to the new value (exponential convergence, not a pass-through).

**Step 3 — hardware verification (HW_VERIFICATION_LOG.md entry required):**
Flash and observe: physically shake the board, confirm a real `vibration_deviation` value prints and changes meaningfully. Breathe on the DHT22 again (as in Session 3) but this time confirm `environment_features_update`'s output value changes, not just the raw reading. Speak near the mic, confirm real (non-zero, changing) mel-frame values print.

---

## Plain-language explain-back

Explain: why Welford's algorithm specifically (not a naive sum-then-divide) for rolling stats — numerical stability over a long-running, never-restarted mean/variance calculation. Why the vibration FFT reconciles a 250-sample collection window with a 128-sample FFT (the spec stated both without mechanically connecting them — this session's implementation is the concrete answer). Why gas compensation coefficients start at exactly 0, not a borrowed generic value.

## Known open items carried forward
🔴 (Carried from Session 3, unrelated to this session's scope) BMP280's real compensation formula still pending — needs the sensor's factory calibration registers, genuinely external data, not something to close by wiring existing pieces together.
