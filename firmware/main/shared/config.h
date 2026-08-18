#pragma once
// REZON constants â€” from specs/technical/02_FIRMWARE_RTOS_TECHNICAL_SPEC.md
// Never hardcode these values elsewhere.

// Thresholds â€” pre-calibration defaults (AI/ML Spec Â§7.3)
#define ALERT_THRESHOLD          0.65f
#define RESPONSE_THRESHOLD       0.85f
#define CORROBORATION_THRESHOLD  0.75f
#define CORROBORATION_COUNT      2

// Actuation gates â€” safety-critical, signed off DEC-015
#define DEBOUNCE_CYCLES          4
#define COOLDOWN_SECONDS         60

// Audio (AI/ML Spec Â§1)
#define AUDIO_SAMPLE_RATE        16000
#define AUDIO_FFT_WINDOW         1024
#define AUDIO_HOP_SIZE           512
#define AUDIO_MEL_BINS           40
#define AUDIO_CONTEXT_FRAMES     6

// ACS712 filter (AI/ML Spec Â§5)
#define CURRENT_EMA_ALPHA        0.2f
