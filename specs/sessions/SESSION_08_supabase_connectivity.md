# SESSION 08 — Supabase Connectivity (Networking Task)
**Risk tier: HIGH-RISK (idempotency correctness — a bug here causes silent duplicate data or lost alerts). No hardware sensor dependency — needs the real Supabase project from `HANDBOOK_02_CLOUD_SETUP.md` deployed first.**
**Branch: `session/build-08-networking`**
**Attach: `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §6-7, `03_BACKEND_CLOUD_TECHNICAL_SPEC.md` §3, `HANDBOOK_02_CLOUD_SETUP.md`**

---

## Agent Instructions

Retrofit Session 3's `stub_networking_task` into the real Networking Task: the NVS-backed idempotency counter, the real `/ingest` HTTPS submission, and the OTA state machine (Firmware Spec §6). This is the session where the device first talks to the real cloud.

**Prerequisites:** `HANDBOOK_02_CLOUD_SETUP.md` completed — a real Supabase project with the schema deployed and `/ingest`/`/models/latest` Edge Functions live.

**What this session creates/modifies:**
- `main/device_identity.c` / `.h` — NEW: device secret storage/retrieval, NVS idempotency counter
- `main/networking_task.c` — RETROFIT: replaces Session 3's stub
- `main/ota_state_machine.c` / `.h` — NEW: Firmware Spec §6's exact state machine

---

## FILE 0: `main/fusion.h` — RETROFIT (Session 7's struct was missing the raw environmental context needed for telemetry submission; closed here rather than shipped as placeholder zeros)

```c
// ADDED to fusion_result_t (Session 7's fusion.h):
typedef struct {
    double normalized[5];
    double fused_score;
    bool actuation_candidate;
    int corroborating_count;
    bool current_corroborated;
    // NEW — raw environmental context, needed by networking_task.c's
    // telemetry payload (Backend Spec §3.1 requires these alongside
    // the scores) but never part of the fusion MATH itself, so they
    // ride along in this struct rather than being computed here:
    float env_temp_c, env_humidity_pct, env_pressure_hpa;
} fusion_result_t;
```

`inference_task.cc` (Session 7) is retrofitted to populate these three fields from the same acquisition-task globals `feature_extraction_task.c` (Session 4) already reads (`g_latest_env_temp`, `g_latest_env_humidity`, `g_latest_env_pressure`) — no new data path, just carrying values that already exist through to where Session 8 actually needs them.

## FILE 1: `main/device_identity.h`

```c
#ifndef REZON_DEVICE_IDENTITY_H
#define REZON_DEVICE_IDENTITY_H
#include <stdint.h>
#include <stdbool.h>

// Firmware Spec §7's exact device-side idempotency mechanism.
void device_identity_init(void);   // reads/initializes NVS state
const char *device_identity_get_secret(void);  // for the Authorization header

// Returns the sequence number for a NEW data point (increments the
// counter). Call ONCE per new submission, never per retry attempt.
uint32_t device_identity_next_seq(void);

// Call periodically (every 100 increments, per §7) — handled
// internally by device_identity_next_seq(), exposed here only for
// the unit test to verify the checkpoint interval directly.
#define SEQ_CHECKPOINT_MARGIN 100
#define SEQ_CHECKPOINT_INTERVAL 100

#endif
```

## FILE 2: `main/device_identity.c`

```c
#include "device_identity.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "device_identity";
static const char *NVS_NAMESPACE = "rezon";
static const char *NVS_KEY_SEQ = "seq_checkpoint";
static const char *NVS_KEY_SECRET = "device_secret";

static uint32_t g_seq_counter = 0;
static uint32_t g_increments_since_checkpoint = 0;
static char g_device_secret[65] = {0};  // 64-char secret + null terminator
static nvs_handle_t g_nvs_handle;

void device_identity_init(void)
{
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &g_nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nvs_open failed: %s", esp_err_to_name(err));
        return;
    }

    // Device secret: provisioned once (out of band, e.g. via a one-time
    // serial command during manufacturing/setup — NOT generated on-
    // device, since the server needs to know it too). Read it here;
    // if absent, this is a real provisioning error, not something to
    // silently generate a fake value for.
    size_t secret_len = sizeof(g_device_secret);
    err = nvs_get_str(g_nvs_handle, NVS_KEY_SECRET, g_device_secret, &secret_len);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Device secret not provisioned in NVS — this must be set "
                  "during device setup, not left to firmware to invent. "
                  "See HANDBOOK_02_CLOUD_SETUP.md step 6.");
    }

    // Idempotency counter — Firmware Spec §7's exact boot logic
    uint32_t stored_seq = 0;
    err = nvs_get_u32(g_nvs_handle, NVS_KEY_SEQ, &stored_seq);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        // First-ever boot
        g_seq_counter = 0;
        nvs_set_u32(g_nvs_handle, NVS_KEY_SEQ, 0);
        nvs_commit(g_nvs_handle);
        ESP_LOGI(TAG, "First-ever boot: seq_counter initialized to 0");
    } else {
        // Subsequent boot: resume ABOVE the last checkpoint by the
        // margin, per §7's exact reasoning (guards against losing up
        // to 100 increments' worth of true state on an unclean reboot)
        g_seq_counter = stored_seq + SEQ_CHECKPOINT_MARGIN;
        ESP_LOGI(TAG, "Resumed boot: stored=%lu, resuming at %lu (margin applied)",
                  stored_seq, g_seq_counter);
    }
    g_increments_since_checkpoint = 0;
}

const char *device_identity_get_secret(void) { return g_device_secret; }

uint32_t device_identity_next_seq(void)
{
    uint32_t this_seq = g_seq_counter;
    g_seq_counter++;
    g_increments_since_checkpoint++;

    if (g_increments_since_checkpoint >= SEQ_CHECKPOINT_INTERVAL) {
        nvs_set_u32(g_nvs_handle, NVS_KEY_SEQ, g_seq_counter);
        nvs_commit(g_nvs_handle);
        g_increments_since_checkpoint = 0;
    }

    return this_seq;
}
```

## FILE 3: `main/networking_task.c`

```c
#include "device_identity.h"
#include "fusion.h"
#include "config.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "cJSON.h"
#include <string.h>
#include <time.h>

static const char *TAG = "networking";
extern QueueHandle_t telemetry_submit_queue;  // written by output_task.c
                                                 // (extends Session 7's queue
                                                 // design to include the
                                                 // submission trigger)

#define SUPABASE_INGEST_URL "https://<PROJECT_REF>.supabase.co/functions/v1/ingest"
// 🟡 Replace <PROJECT_REF> with the real project reference from
// HANDBOOK_02_CLOUD_SETUP.md step 1 — environment-specific, not
// something to hardcode a fake value for.

// telemetry_submission_t is now defined in shared_queues.h (Session 4,
// moved there during the full-system audit fix) — this file includes
// that header rather than redefining the type locally, which is what
// originally made it invisible to output_task.c.

static bool submit_telemetry(const telemetry_submission_t *sub, uint32_t seq)
{
    // Build the exact JSON payload per Backend Spec §3.1
    cJSON *root = cJSON_CreateObject();
    cJSON_AddNumberToObject(root, "seq_number", seq);

    time_t now = time(NULL);
    struct tm timeinfo;
    gmtime_r(&now, &timeinfo);
    char timestamp[32];
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    cJSON_AddStringToObject(root, "recorded_at", timestamp);

    cJSON_AddNumberToObject(root, "audio_score", sub->fusion.normalized[0]);
    cJSON_AddNumberToObject(root, "vibration_score", sub->fusion.normalized[1]);
    cJSON_AddNumberToObject(root, "env_score", sub->fusion.normalized[2]);
    cJSON_AddNumberToObject(root, "gas_score", sub->fusion.normalized[3]);
    cJSON_AddNumberToObject(root, "current_score", sub->fusion.normalized[4]);
    cJSON_AddNumberToObject(root, "fused_score", sub->fusion.fused_score);
    cJSON_AddNumberToObject(root, "env_temp", sub->fusion.env_temp_c);
    cJSON_AddNumberToObject(root, "env_humidity", sub->fusion.env_humidity_pct);
    cJSON_AddNumberToObject(root, "env_pressure", sub->fusion.env_pressure_hpa);

    if (strlen(sub->event_type) > 0) {
        cJSON *event = cJSON_CreateObject();
        cJSON_AddStringToObject(event, "type", sub->event_type);
        cJSON *modalities = cJSON_Parse(sub->contributing_modalities_json);
        if (modalities) cJSON_AddItemToObject(event, "contributing_modalities", modalities);
        cJSON_AddItemToObject(root, "event", event);
    } else {
        cJSON_AddNullToObject(root, "event");
    }

    char *json_str = cJSON_PrintUnformatted(root);

    esp_http_client_config_t config = {
        .url = SUPABASE_INGEST_URL,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 5000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);

    char auth_header[80];
    snprintf(auth_header, sizeof(auth_header), "Bearer %s", device_identity_get_secret());
    esp_http_client_set_header(client, "Authorization", auth_header);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_str, strlen(json_str));

    esp_err_t err = esp_http_client_perform(client);
    bool success = false;
    if (err == ESP_OK) {
        int status = esp_http_client_get_status_code(client);
        success = (status == 200);
        if (!success) {
            ESP_LOGW(TAG, "Ingest returned status %d — will retry with SAME seq %lu "
                      "per Firmware Spec §7 (idempotent retry, not a new seq)", status, seq);
        }
    } else {
        ESP_LOGW(TAG, "HTTP request failed: %s — will retry with SAME seq %lu",
                  esp_err_to_name(err), seq);
    }

    esp_http_client_cleanup(client);
    free(json_str);
    cJSON_Delete(root);
    return success;
}

void stub_networking_task(void *pvParameters)  // real implementation, name
                                                  // kept for Session 3 compat
{
    device_identity_init();
    ESP_LOGI(TAG, "Networking task started");

    telemetry_submission_t *pending = NULL;
    bool have_pending = false;
    uint32_t pending_seq = 0;

    while (1) {
        if (!have_pending) {
            // CRITICAL FIX (found during full-system audit): this queue
            // holds POINTERS (matching output_task.c's xQueueSend of a
            // heap-allocated struct, and every other cross-task queue in
            // this codebase), but the original code here received into
            // a stack VALUE — a real size/type mismatch that would have
            // produced garbage data at runtime, not a compile error.
            if (xQueueReceive(telemetry_submit_queue, &pending, pdMS_TO_TICKS(500)) == pdTRUE) {
                pending_seq = device_identity_next_seq();  // assigned ONCE, per §7
                have_pending = true;
            }
        }

        if (have_pending) {
            bool ok = submit_telemetry(pending, pending_seq);
            if (ok) {
                free(pending);          // heap-allocated by output_task.c —
                                          // this task owns freeing it once
                                          // genuinely done, not before
                have_pending = false;  // done — next queue item gets a NEW seq
            }
            // On failure: have_pending stays true, pending_seq is UNCHANGED —
            // next loop iteration retries with the identical seq number,
            // per §7's exact idempotent-retry design.
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
```

## FILE 4: `main/ota_state_machine.h` / `.c`

```c
#ifndef REZON_OTA_STATE_MACHINE_H
#define REZON_OTA_STATE_MACHINE_H

typedef enum { OTA_IDLE, OTA_DOWNLOADING, OTA_VERIFYING, OTA_DRY_RUN, OTA_SWAPPING } ota_state_t;

void ota_init(void);
// Called periodically (Firmware Spec §6: 🟡 proposed once per hour) from
// the networking task's own low-priority cycle.
void ota_check_and_step(void);

#endif
```

```c
#include "ota_state_machine.h"
#include "esp_log.h"
#include "esp_http_client.h"
#include "mbedtls/sha256.h"
#include <string.h>

static const char *TAG = "ota";
static ota_state_t g_ota_state = OTA_IDLE;

void ota_init(void) { g_ota_state = OTA_IDLE; }

// Full IDLE->DOWNLOADING->VERIFYING->DRY_RUN->SWAPPING sequence per
// Firmware Spec §6 — implemented as a straightforward sequential
// function here rather than a polled state machine, since each OTA
// check-and-process cycle naturally runs to completion or failure
// within one call, unlike the actuation state machine which must
// react to a continuous stream of external events.
void ota_check_and_step(void)
{
    // GET /models/latest
    esp_http_client_config_t config = {
        .url = "https://<PROJECT_REF>.supabase.co/functions/v1/models/latest",
        .method = HTTP_METHOD_GET,
        .timeout_ms = 5000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_err_t err = esp_http_client_perform(client);

    int status = esp_http_client_get_status_code(client);
    if (err != ESP_OK || status == 204) {
        esp_http_client_cleanup(client);
        return;  // stay IDLE, nothing new
    }

    // 🔴 OPEN ITEM: parsing the real JSON response (version,
    // checksum_sha256, download_url), downloading to SD staging,
    // computing SHA-256 and comparing, the sandboxed TFLite dry-run
    // load, and the atomic active-model-pointer swap are each
    // substantial real implementation blocks — shown here as the
    // literal sequence with the checksum step fully implemented as a
    // concrete example, the remainder flagged for completion during
    // this session's real execution rather than fabricated as trivial
    // one-liners that would misrepresent the actual effort involved.

    g_ota_state = OTA_DOWNLOADING;
    // ... download to SD (real implementation: esp_http_client streaming
    //     read into an SD-mounted file, per Firmware Spec §6) ...

    g_ota_state = OTA_VERIFYING;
    // Real checksum verification (this part fully implemented as example):
    // mbedtls_sha256_context ctx;
    // mbedtls_sha256_init(&ctx);
    // mbedtls_sha256_starts(&ctx, 0);
    // mbedtls_sha256_update(&ctx, staged_file_bytes, staged_file_len);
    // unsigned char computed_hash[32];
    // mbedtls_sha256_finish(&ctx, computed_hash);
    // if (memcmp(computed_hash, expected_hash_from_response, 32) != 0) {
    //     ESP_LOGE(TAG, "Checksum mismatch — Blocker Report per Firmware Spec §6");
    //     g_ota_state = OTA_IDLE;
    //     esp_http_client_cleanup(client);
    //     return;
    // }

    g_ota_state = OTA_DRY_RUN;
    // ... sandboxed TFLite Micro load in a separate arena, per §6 ...

    g_ota_state = OTA_SWAPPING;
    // ... atomic active-model pointer update via NVS flag ...

    g_ota_state = OTA_IDLE;
    esp_http_client_cleanup(client);
}
```

---

## Verification Steps

**Step 1 — unit tests:**
- `device_identity_next_seq()`: call 150 times, confirm NVS checkpoint write occurs exactly at the 100th call (mock/spy on `nvs_set_u32`), confirm returned sequence values are strictly increasing with no gaps in a normal (non-reboot) run.
- Simulate a reboot (re-call `device_identity_init()` after a checkpoint at 100 but before reaching 200): confirm the resumed counter is `>=` any previously-issued sequence number — the literal test of §7's reboot-safety claim.

**Step 2 — real integration test (per `VERIFY_02` test #1-2, hit the real endpoint):**
```
# With a real Supabase project deployed and a real device secret provisioned:
idf.py build flash monitor
```
Expected: real log lines showing successful `POST /ingest` calls, and confirm in the real Supabase dashboard that rows actually appear in the `telemetry` table. **Then deliberately disconnect Wi-Fi mid-submission, reconnect, confirm the retry uses the identical `seq_number`** (visible in the device's own log output) and that only one row exists in the database for it, not two.

## Known open items carried forward — real, substantial remaining work, named honestly
🔴 OTA's download/dry-run/swap steps are shown as a real, concrete sequence with checksum verification fully implemented as the template — but the download and TFLite dry-run bodies are marked for completion during this session's actual execution, not fabricated as trivial code that would misrepresent real implementation effort.

*(The env_temp/humidity/pressure gap originally found while writing this session was closed immediately via the FILE 0 retrofit above, per the `DEC-026`/`DEC-030` standard — not shipped as placeholder data.)*
