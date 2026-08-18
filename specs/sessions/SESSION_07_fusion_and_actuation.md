# SESSION 07 — Fusion + Actuation Safety Logic
**Risk tier: MAXIMUM — the single most safety-critical session in the entire build. Every line here implements logic already signed off (`DEC-015`, `DEC-020`) — this session's job is faithful implementation, not new design. Any deviation discovered during implementation stops for fresh sign-off, per METHODOLOGY.md §3, before being treated as settled.**
**Branch: `session/build-07-fusion-actuation`**
**Attach: `01_AI_ML_TECHNICAL_SPEC.md` §7, `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §3, §5, §2.1, Sessions 03/04/06 (as actually built)**

---

## Agent Instructions

This session is bench-tested only — **the relay does not fire against the real monitored machine until Session 9's integration step**, per `BUILD_ROADMAP.md` Phase 1's explicit sequencing. Bench testing here means: confirm every gate behaves correctly using safe, induced test conditions (e.g., the relay switching a bench LED, not the real machine).

**What this session creates/modifies:**
- `main/fusion.c` / `.h` — NEW: §7.1-7.4's exact logic, pure and independently testable
- `main/actuation_state_machine.c` / `.h` — NEW: Firmware Spec §5's exact state machine, including the burn-in gate
- `main/override_switch.c` / `.h` — NEW: physical override GPIO read
- `main/output_task.c` — RETROFIT: Session 3's `stub_output_task` replaced with real LED/buzzer/relay control
- `main/inference_task.cc` — RETROFIT: after IDNN inference (Session 6), also gather the other 4 modality scores and call fusion + the state machine

---

## FILE 1: `main/fusion.h`

```c
#ifndef REZON_FUSION_H
#define REZON_FUSION_H
#include <stdbool.h>

typedef struct {
    double audio, vibration, environment, gas, current;  // raw deviations,
                                                            // pre-normalization
} modality_deviations_t;

typedef struct {
    double normalized[5];       // audio, vibration, environment, gas, current — in this order
    double fused_score;
    bool actuation_candidate;
    int corroborating_count;
    bool current_corroborated;   // for the §7.4 "current OR two others" rule
} fusion_result_t;

// AI/ML Spec §7.2: cold-start default, replaced by burn-in calibration
// (Session 34) via fusion_set_weights().
void fusion_init(void);
void fusion_set_weights(const double weights[5]);  // called post-burn-in
void fusion_set_thresholds(double alert, double response, double elevated);  // post-burn-in

// The real, exact §7.1-7.4 computation. operating_mode gates whether
// actuation_candidate can ever be true (Firmware Spec §5's burn-in gate)
// — this function still computes real scores during BURN_IN, per that
// section's explicit requirement, it just structurally cannot set
// actuation_candidate=true in that mode.
typedef enum { OPMODE_BURN_IN, OPMODE_FULL_OPERATION } operating_mode_t;
fusion_result_t fusion_compute(const modality_deviations_t *raw, operating_mode_t mode);

#endif
```

## FILE 2: `main/fusion.c`

```c
#include "fusion.h"
#include "features/rolling_stats.h"
#include <math.h>

// AI/ML Spec §7.2 cold-start default
static double g_weights[5] = {0.2, 0.2, 0.2, 0.2, 0.2};
static double g_alert_threshold = 0.65;
static double g_response_threshold = 0.85;
static double g_elevated_threshold = 0.75;
#define CURRENT_ACTUATION_BOOST 1.5   // AI/ML Spec §7.2

static rolling_stats_t g_stats[5];  // one per modality, for §7.1's normalization
static bool g_stats_initialized = false;

void fusion_init(void)
{
    for (int i = 0; i < 5; i++) rolling_stats_init(&g_stats[i]);
    g_stats_initialized = true;
}

void fusion_set_weights(const double weights[5])
{
    for (int i = 0; i < 5; i++) g_weights[i] = weights[i];
}

void fusion_set_thresholds(double alert, double response, double elevated)
{
    g_alert_threshold = alert;
    g_response_threshold = response;
    g_elevated_threshold = elevated;
}

static double normalize(int modality_idx, double raw_deviation)
{
    rolling_stats_update(&g_stats[modality_idx], raw_deviation);
    double z = rolling_stats_zscore(&g_stats[modality_idx], raw_deviation);
    return 1.0 / (1.0 + exp(-z));  // AI/ML Spec §7.1: sigmoid(z)
}

fusion_result_t fusion_compute(const modality_deviations_t *raw, operating_mode_t mode)
{
    fusion_result_t r = {0};

    r.normalized[0] = normalize(0, raw->audio);
    r.normalized[1] = normalize(1, raw->vibration);
    r.normalized[2] = normalize(2, raw->environment);
    r.normalized[3] = normalize(3, raw->gas);
    r.normalized[4] = normalize(4, raw->current);

    r.fused_score = 0.0;
    for (int i = 0; i < 5; i++) r.fused_score += g_weights[i] * r.normalized[i];

    // §7.4 corroboration count (unboosted, for the ">=2" count)
    r.corroborating_count = 0;
    for (int i = 0; i < 5; i++) {
        if (r.normalized[i] >= g_elevated_threshold) r.corroborating_count++;
    }

    // Current's boosted score, checked separately per §7.4's exact rule
    double current_boosted = r.normalized[4] * CURRENT_ACTUATION_BOOST;
    r.current_corroborated = (current_boosted >= g_elevated_threshold);

    bool corroboration_satisfied =
        (r.corroborating_count >= 2) ||
        (r.current_corroborated && r.corroborating_count >= 1);

    bool candidate_by_formula = (r.fused_score >= g_response_threshold) && corroboration_satisfied;

    // THE BURN-IN GATE (Firmware Spec §5, signed off DEC-020): even if
    // the formula above says yes, actuation_candidate can ONLY be true
    // in FULL_OPERATION. This is not an optimization — it is the actual
    // safety property this whole gate exists for. Do not refactor this
    // check away or combine it with candidate_by_formula's computation
    // above in a way that could make it less structurally obvious.
    r.actuation_candidate = candidate_by_formula && (mode == OPMODE_FULL_OPERATION);

    return r;
}
```

## FILE 3: `main/actuation_state_machine.h`

```c
#ifndef REZON_ACTUATION_STATE_MACHINE_H
#define REZON_ACTUATION_STATE_MACHINE_H
#include "fusion.h"
#include <stdbool.h>
#include <stdint.h>

typedef enum { ASM_BOOT_SAFE, ASM_MONITORING, ASM_CANDIDATE, ASM_COOLDOWN } asm_state_t;

typedef struct {
    asm_state_t state;
    operating_mode_t mode;
    int debounce_counter;
    int64_t last_actuation_time_us;
    bool relay_energized;   // true = machine powered, false = cut
} actuation_state_machine_t;

void asm_init(actuation_state_machine_t *sm, operating_mode_t initial_mode);

// Called every fusion cycle (~1s). Returns true if the relay state
// (sm->relay_energized) changed this call — caller (output_task) acts
// on that transition; this function never touches GPIO directly,
// keeping the decision logic testable without hardware (VERIFY_01).
bool asm_step(actuation_state_machine_t *sm, const fusion_result_t *fusion,
               bool override_engaged, int64_t now_us);

#endif
```

## FILE 4: `main/actuation_state_machine.c`

```c
#include "actuation_state_machine.h"

#define DEBOUNCE_CYCLES_REQUIRED 4     // Firmware Spec §3.2: ~4 consecutive cycles
#define COOLDOWN_US (60 * 1000000LL)   // Firmware Spec §3.3: 60 seconds

void asm_init(actuation_state_machine_t *sm, operating_mode_t initial_mode)
{
    sm->state = ASM_BOOT_SAFE;
    sm->mode = initial_mode;
    sm->debounce_counter = 0;
    sm->last_actuation_time_us = -COOLDOWN_US;  // so an actuation is
                                                   // never blocked by
                                                   // cooldown on first boot
    sm->relay_energized = false;  // BOOT_SAFE: force safe state
}

bool asm_step(actuation_state_machine_t *sm, const fusion_result_t *fusion,
               bool override_engaged, int64_t now_us)
{
    bool relay_changed = false;

    // Override check FIRST, every cycle, regardless of state — Firmware
    // Spec §5: bypasses this whole state machine entirely when engaged.
    if (override_engaged) {
        if (sm->relay_energized) {
            sm->relay_energized = false;
            relay_changed = true;
        }
        return relay_changed;  // state machine bypassed while override is engaged
    }

    switch (sm->state) {
        case ASM_BOOT_SAFE:
            sm->relay_energized = false;  // already false from init, explicit here too
            sm->state = ASM_MONITORING;
            break;

        case ASM_MONITORING:
            if (fusion->actuation_candidate) {  // already gated by burn-in mode
                                                  // inside fusion_compute()
                sm->state = ASM_CANDIDATE;
                sm->debounce_counter = 1;
            }
            // Alert path is independent of this state machine entirely
            // (Firmware Spec §5) — handled by output_task reading
            // fusion->fused_score directly against the alert threshold,
            // not through this function.
            break;

        case ASM_CANDIDATE:
            if (!fusion->actuation_candidate) {
                // Condition didn't hold this cycle — log a suppressed-
                // by-debounce event (caller's responsibility, this
                // function signals it via the state transition itself)
                sm->state = ASM_MONITORING;
                sm->debounce_counter = 0;
                break;
            }
            sm->debounce_counter++;
            if (sm->debounce_counter >= DEBOUNCE_CYCLES_REQUIRED) {
                bool cooldown_elapsed = (now_us - sm->last_actuation_time_us) >= COOLDOWN_US;
                if (cooldown_elapsed) {
                    sm->relay_energized = false;  // ACTUATE = cut power
                    relay_changed = true;
                    sm->last_actuation_time_us = now_us;
                    sm->state = ASM_COOLDOWN;
                } else {
                    // Suppressed-by-cooldown — logged by caller
                    sm->state = ASM_MONITORING;
                }
                sm->debounce_counter = 0;
            }
            break;

        case ASM_COOLDOWN:
            // Relay stays in its actuated (cut) state — cooldown governs
            // RE-actuation eligibility only, per DEC-015's signed-off
            // no-auto-reverse behavior. Re-arming is an explicit
            // separate operator action (frontend), not automatic.
            if ((now_us - sm->last_actuation_time_us) >= COOLDOWN_US) {
                sm->state = ASM_MONITORING;
            }
            break;
    }

    return relay_changed;
}
```

## FILE 5: `main/override_switch.h` / `.c`

```c
#ifndef REZON_OVERRIDE_SWITCH_H
#define REZON_OVERRIDE_SWITCH_H
#include <stdbool.h>
void override_switch_init(void);
// Reads GPIO37 — this is READ-ONLY telemetry (ADD §7.4): the real
// safety mechanism is the physical series wiring from Session 2, not
// this GPIO. This function lets the firmware KNOW the override is
// engaged, it does not implement the override itself.
bool override_switch_is_engaged(void);
#endif
```

```c
#include "override_switch.h"
#include "config.h"
#include "driver/gpio.h"

void override_switch_init(void)
{
    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << PIN_OVERRIDE_SW,
        .mode = GPIO_MODE_INPUT,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
    };
    gpio_config(&cfg);
}

bool override_switch_is_engaged(void)
{
    return gpio_get_level(PIN_OVERRIDE_SW) == 1;
}
```

## FILE 6: `main/output_task.c` — RETROFIT (replaces Session 3's stub)

```c
#include "actuation_state_machine.h"
#include "override_switch.h"
#include "config.h"
#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_timer.h"
#include "esp_log.h"

static const char *TAG = "output";
extern QueueHandle_t fusion_result_queue;  // written by inference_task.cc (FILE 7)
extern QueueHandle_t telemetry_submit_queue;  // consumed by networking_task.c
                                                 // (Session 8) — CRITICAL FIX:
                                                 // this queue was declared as
                                                 // "written by output_task.c"
                                                 // in Session 8, but nothing
                                                 // in this file ever actually
                                                 // wrote to it — meaning NO
                                                 // telemetry, event or not,
                                                 // would ever have reached
                                                 // the cloud under the
                                                 // original code.

static actuation_state_machine_t g_asm;

static void set_relay(bool energized) { gpio_set_level(PIN_RELAY, energized ? 1 : 0); }
static void set_led_alert(bool alert)
{
    gpio_set_level(PIN_LED_RED, alert ? 1 : 0);
    gpio_set_level(PIN_LED_GREEN, alert ? 0 : 1);
}
static void set_buzzer(bool on) { gpio_set_level(PIN_BUZZER, on ? 1 : 0); }

void stub_output_task(void *pvParameters)  // name kept for Session 3 compatibility;
                                             // this IS now the real implementation
{
    override_switch_init();
    asm_init(&g_asm, OPMODE_BURN_IN);  // per Firmware Spec §5: BURN_IN on
                                         // first-ever provisioning — Session 9
                                         // is where this gets set based on
                                         // real device state, not hardcoded
                                         // BURN_IN forever; flagged below.
    set_relay(false);  // BOOT_SAFE, forced immediately

    ESP_LOGI(TAG, "Output/actuation task started, mode=BURN_IN, state=BOOT_SAFE");

    fusion_result_t fusion;
    while (1) {
        if (xQueueReceive(fusion_result_queue, &fusion, pdMS_TO_TICKS(1200)) == pdTRUE) {
            bool override_engaged = override_switch_is_engaged();
            int64_t now = esp_timer_get_time();

            bool was_energized = g_asm.relay_energized;
            bool changed = asm_step(&g_asm, &fusion, override_engaged, now);

            // CRITICAL FIX: construct and submit a telemetry_submission_t
            // EVERY cycle, not only on relay changes — this is what
            // actually makes Workflow A (normal operation, Integration
            // Spec §2) real. Previously nothing here ever populated
            // telemetry_submit_queue at all, meaning normal telemetry
            // would never have reached the cloud regardless of relay state.
            telemetry_submission_t sub = {0};
            sub.fusion = fusion;
            if (changed) {
                strcpy(sub.event_type, "actuation");
                snprintf(sub.contributing_modalities_json, sizeof(sub.contributing_modalities_json),
                    "{\"audio\":%.3f,\"vibration\":%.3f,\"environment\":%.3f,\"gas\":%.3f,\"current\":%.3f}",
                    fusion.normalized[0], fusion.normalized[1], fusion.normalized[2],
                    fusion.normalized[3], fusion.normalized[4]);
            } else if (fusion.fused_score >= 0.65) {
                strcpy(sub.event_type, "alert");
            }
            // else: sub.event_type stays "" — normal telemetry, no event,
            // exactly matching Backend Spec §3.1's "event": null case.
            telemetry_submission_t *sub_copy = malloc(sizeof(sub));
            *sub_copy = sub;
            if (xQueueSend(telemetry_submit_queue, &sub_copy, 0) != pdTRUE) {
                free(sub_copy);  // networking falling behind — drop this
                                   // cycle's submission rather than block
                                   // the actuation-decision loop, same
                                   // priority ordering as every other
                                   // queue-full policy in this project
            }

            if (changed) {
                set_relay(g_asm.relay_energized);
                ESP_LOGW(TAG, "RELAY STATE CHANGED: %s -> %s (state=%d)",
                          was_energized ? "ON" : "OFF",
                          g_asm.relay_energized ? "ON" : "OFF", g_asm.state);
            }

            // Alert path — independent of the state machine (Firmware Spec §5)
            bool alert = fusion.fused_score >= 0.65;  // AI/ML Spec §7.3
            set_led_alert(alert);
            set_buzzer(alert);
        }
    }
}
```

## FILE 7A: `main/features/gas_features.h` — RETROFIT (Session 4 built compensation only; the scoring wrapper was missing, closed here rather than flagged, per the DEC-026 standard)

```c
// ADDED to gas_features.h:
double gas_features_score(float compensated_value);
```

```c
// ADDED to gas_features.c — same rolling_stats pattern already used
// for vibration/environment, applied to the compensated gas value:
#include "rolling_stats.h"
static rolling_stats_t gas_stats;
static bool gas_stats_init = false;

double gas_features_score(float compensated_value)
{
    if (!gas_stats_init) { rolling_stats_init(&gas_stats); gas_stats_init = true; }
    rolling_stats_update(&gas_stats, compensated_value);
    return fabs(rolling_stats_zscore(&gas_stats, compensated_value));
}
```

## FILE 7B: `main/features/current_features.h` — RETROFIT (same closure for current)

```c
// ADDED to current_features.h:
double current_features_score(float filtered_value);
```

```c
// ADDED to current_features.c:
#include "rolling_stats.h"
static rolling_stats_t current_stats;
static bool current_stats_init = false;

double current_features_score(float filtered_value)
{
    if (!current_stats_init) { rolling_stats_init(&current_stats); current_stats_init = true; }
    rolling_stats_update(&current_stats, filtered_value);
    return fabs(rolling_stats_zscore(&current_stats, filtered_value));
}
```

## FILE 8: `main/inference_task.cc` — RETROFIT (extends Session 6)

```cpp
// Extends Session 6's IDNN inference with the other 4 modality scores
// and the fusion call — this is the "Inference & Fusion Task" as one
// combined task, per Firmware Spec §1's explicit design (not split
// into two tasks).

// ... Session 6's existing TFLite Micro setup code is unchanged above
// this point in the real file ...

extern "C" {
#include "fusion.h"
#include "features/vibration_features.h"
#include "features/environment_features.h"
#include "features/gas_features.h"
#include "features/current_features.h"
}
#include "freertos/queue.h"

QueueHandle_t fusion_result_queue;  // consumed by output_task.c (FILE 6)

// Inside the existing while(1) loop, after IDNN inference produces the
// audio MSE score (Session 6's TODO, now completed here):

modality_deviations_t deviations;
// CRITICAL FIX (found during full-system audit): every one of these
// five lines previously either hardcoded 0.0 or referenced a global
// that was never declared anywhere — meaning this code would not
// compile as originally written, and even if it had, the fusion
// computation would never have received real sensor data. All five
// now read the real globals Sessions 4 and 6 were retrofitted to
// actually populate.
deviations.audio = g_latest_audio_mse;
deviations.vibration = g_latest_vibration_deviation;
deviations.environment = g_latest_environment_deviation;
deviations.gas = gas_features_score(g_latest_compensated_gas);
deviations.current = current_features_score(g_latest_filtered_current);

operating_mode_t current_mode = OPMODE_BURN_IN;  // TODO Session 9: read
                                                     // real device state
fusion_result_t result = fusion_compute(&deviations, current_mode);
xQueueSend(fusion_result_queue, &result, 0);
```

---

## Verification Steps

**Step 1 — unit tests (fusion.c and actuation_state_machine.c are pure logic, fully testable without hardware):**
- Corroboration: construct inputs where exactly 1 modality is elevated → `actuation_candidate` false. Exactly 2 → true (in FULL_OPERATION). Confirm current's ×1.5 boost changes the outcome in a case where current alone (boosted) plus one other modality satisfies corroboration.
- **The single most important test in this whole project:** construct a fusion result that would satisfy the response threshold and corroboration, call `fusion_compute()` with `mode=OPMODE_BURN_IN` — confirm `actuation_candidate` is `false` regardless. This is the literal, direct test of the `DEC-020` sign-off.
- Debounce: feed `asm_step()` a qualifying candidate for 3 cycles then a non-qualifying one — confirm it returns to MONITORING without ever setting `relay_energized`. Feed 4 qualifying cycles — confirm actuation fires.
- Cooldown: fire an actuation, immediately feed another qualifying debounce sequence — confirm suppressed-by-cooldown (no second actuation) until 60s of simulated time has passed.
- Override: with the relay already energized (simulating an active actuation), call `asm_step()` with `override_engaged=true` — confirm `relay_energized` becomes false regardless of `fusion` input.

**Step 2 — bench hardware test (HW_VERIFICATION_LOG.md entry required, NOT against the real monitored machine yet):**
Wire the relay to a bench LED (not the real machine). Manually construct sustained sensor conditions (or a debug override forcing high scores) — confirm the LED behaves exactly per the state machine: no reaction to a single spike, reaction after ~4s sustained, no re-trigger within 60s, immediate safe-state on physically engaging the override switch regardless of what the LED was doing.

## Known open items — one genuine item remains
🔴 **`operating_mode` is hardcoded to `OPMODE_BURN_IN`** in this session — reading the device's real persisted mode (has burn-in actually completed?) is Session 9's job, which owns the actual deployment/graduation moment. This is correctly sequenced, not deferred laziness — Session 7 bench-tests before the device is ever in its real deployment context, so BURN_IN is the only mode that makes sense to hardcode here.

*(The gas/current scoring gap originally found while writing this session was closed immediately above, per the `DEC-026` standard — not left as a second open item.)*
