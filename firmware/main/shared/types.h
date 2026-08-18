#pragma once
#include <stdbool.h>
#include <stdint.h>

// Shared structs used across RTOS tasks via queues.
// Defined here so both producers and consumers see the same definition (DEC-068 fix).

typedef struct {
    float audio_score;
    float vibration_score;
    float environment_score;
    float gas_score;
    float current_score;
    float fused_score;
    float env_temp;
    float env_humidity;
    float env_pressure;
    bool  relay_active;
    bool  vibration_hw_confirmed;
} fusion_result_t;

typedef struct {
    uint32_t       seq_number;
    fusion_result_t result;
    char           event_type[32];
    uint32_t       recorded_at_unix;
    int32_t        free_heap_bytes;
    int32_t        psram_used_bytes;
    int32_t        psram_total_bytes;
    int8_t         wifi_rssi_dbm;
    int32_t        sd_buffer_minutes;
} telemetry_submission_t;

typedef enum { OPMODE_BURN_IN, OPMODE_FULL_OPERATION } operating_mode_t;
typedef enum { ASM_BOOT_SAFE, ASM_MONITORING, ASM_CANDIDATE, ASM_COOLDOWN } actuation_state_t;
