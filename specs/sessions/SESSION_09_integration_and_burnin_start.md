# SESSION 09 — Integration, Deployment, and Burn-In Start
**Risk tier: MAXIMUM — first time all 8 prior sessions run together as one real system, and the last gate before the device starts making real decisions about a real space. This session closes Phase 1.**
**Branch: `session/build-09-integration-burnin`**
**Attach: ALL prior session specs (as actually built), `01_AI_ML_TECHNICAL_SPEC.md` §10, `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §5, `06_INTEGRATION_DATA_FLOW_SPEC.md`, `VERIFY_02_INTEGRATION_TESTS.md`, `BUILD_ROADMAP.md`**

---

## Agent Instructions

Three things, in order: (1) close the one remaining hardcoded value from Session 7 — `operating_mode` reads real persisted state instead of always being `BURN_IN`; (2) run the actual end-to-end integration tests from `VERIFY_02` for the first time, for real, against the real deployed system; (3) physically deploy the device to its real target space and start the burn-in clock.

**What this session creates/modifies:**
- `main/device_identity.c` — RETROFIT: add `operating_mode` NVS persistence (first-ever boot = BURN_IN, matching Firmware Spec §5)
- `main/output_task.c` — RETROFIT: read real persisted mode instead of Session 7's hardcoded `OPMODE_BURN_IN`
- `main/rezon_main.c` — RETROFIT: final review pass, confirm task creation order and naming makes sense now that every task is a real implementation (Session 3's `stub_*` naming was a placeholder convention, not a permanent one)

---

## FILE 1: `main/device_identity.h` — RETROFIT (add operating_mode persistence)

```c
// ADDED to device_identity.h:
#include "fusion.h"  // for operating_mode_t

operating_mode_t device_identity_get_operating_mode(void);
// Only ever called from Session 34 (calibration), once burn-in's
// stopping rule (AI/ML Spec §10) is satisfied — not exposed for casual
// use elsewhere, since an accidental early call would be exactly the
// failure DEC-019/020 closed.
void device_identity_set_operating_mode(operating_mode_t mode);
```

```c
// ADDED to device_identity.c:
static const char *NVS_KEY_MODE = "operating_mode";

operating_mode_t device_identity_get_operating_mode(void)
{
    uint8_t stored_mode;
    esp_err_t err = nvs_get_u8(g_nvs_handle, NVS_KEY_MODE, &stored_mode);
    if (err == ESP_ERR_NVS_NOT_FOUND) {
        // First-ever boot: Firmware Spec §5 — always starts BURN_IN,
        // never FULL_OPERATION by default. This is the literal
        // implementation of the safety property DEC-020 signed off on.
        device_identity_set_operating_mode(OPMODE_BURN_IN);
        return OPMODE_BURN_IN;
    }
    return (operating_mode_t)stored_mode;
}

void device_identity_set_operating_mode(operating_mode_t mode)
{
    nvs_set_u8(g_nvs_handle, NVS_KEY_MODE, (uint8_t)mode);
    nvs_commit(g_nvs_handle);  // committed immediately, not batched —
                                 // this is a rare, safety-relevant write,
                                 // not a high-frequency one like seq_counter
    ESP_LOGW("device_identity", "operating_mode changed to %d — logged "
              "prominently since this gates actuation capability entirely",
              (int)mode);
}
```

## FILE 2: `main/output_task.c` — RETROFIT (Session 7's hardcode replaced)

```c
// Session 7 had: asm_init(&g_asm, OPMODE_BURN_IN);  // hardcoded
// REPLACED with:
operating_mode_t real_mode = device_identity_get_operating_mode();
asm_init(&g_asm, real_mode);
ESP_LOGI(TAG, "Output/actuation task started, mode=%s, state=BOOT_SAFE",
          real_mode == OPMODE_BURN_IN ? "BURN_IN" : "FULL_OPERATION");
```

**Note on the BURN_IN→FULL_OPERATION transition mechanism itself:** deliberately NOT implemented in this session. The transition only happens once, weeks from now, when Session 34's calibration pass completes — implementing the trigger mechanism now, before that context exists, risks guessing wrong the same way pre-writing Sessions 5-9 before Sessions 3-4 ran would have. This is correctly deferred to Session 34, not a gap — `device_identity_set_operating_mode()` above is the function Session 34 will call; how it decides *when* to call it is that session's design question, informed by real burn-in data this session doesn't have yet.

## FILE 3: `main/rezon_main.c` — RETROFIT (final naming pass)

```c
// Every "stub_X_task" function is now a REAL implementation (Sessions
// 4/6/7/8 replaced each body in turn) — the stub_ prefix was Session
// 3's placeholder convention, not a permanent name. Renamed here for
// clarity, now that the whole system is real:
//   stub_feature_extraction_task -> feature_extraction_task  (Session 4)
//   stub_inference_task          -> inference_task            (Session 6/7, .cc)
//   stub_networking_task         -> networking_task            (Session 8)
//   stub_output_task             -> output_task                (Session 7)
// acquisition_task was never a stub — unchanged.
//
// This is a pure rename (find/replace across the real codebase, update
// the 5 xTaskCreatePinnedToCore calls in this file) — no logic change,
// done now specifically because Session 9 is the natural "the system is
// finally whole" checkpoint, not earlier when tasks were still partial.
```

---

## Verification Steps — the real end-to-end tests, run for the first time

**Step 1 — full system boot:**
```
idf.py build flash monitor
```
Expected: all 5 tasks start without error, log shows `mode=BURN_IN` from the output task (first-ever boot), I2C probe finds both devices, HTTPS submissions begin appearing in the real Supabase `telemetry` table.

**Step 2 — `VERIFY_02` test #1 (device → /ingest round trip), for real this time:**
Confirm real device data — not a simulated payload — lands in the real `telemetry` table with `env_score`, `audio_score`, etc. all populated with real (non-placeholder, non-zero-by-default) values.

**Step 3 — `VERIFY_02` test #2 (duplicate submission under real network conditions):**
Physically disable Wi-Fi for ~10 seconds while the device is mid-submission, re-enable, confirm from the real device log that the retry used the identical `seq_number`, and confirm in Supabase that exactly one row exists for it.

**Step 4 — the actual safety-gauntlet, now end-to-end (bench-safe, still not against the final real machine per BUILD_ROADMAP.md's phasing — that's Session 35):**
Induce a real, sustained condition across ≥2 modalities (e.g., physically shake the board near a running fan while breathing on the gas sensor) for well over the debounce window. Confirm: alert fires (LED/buzzer) quickly, **actuation does NOT fire** — confirm via log that `actuation_candidate` was structurally blocked by `mode=BURN_IN`, not that it just happened not to trigger. This is the live, physical confirmation of the exact property `DEC-020` signed off on, now proven under real induced conditions rather than only a unit test.

**Step 5 — mid-Phase-1 audit, if not already run:**
If `AUDIT_01` hasn't been run yet, this is the latest point it should happen — Sessions 5-8 have now all been built on top of Sessions 1-4's foundation, exactly the scenario the audit exists to check before proceeding further.

**Step 6 — physical deployment:**
Per `HANDBOOK_01_HARDWARE_SETUP.md` and the ADD's field-calibration design (§10.4): move the device to its real target space, power it on there, confirm it's reporting from that real location (not the workbench).

**Step 7 — start the burn-in clock:**
Log a Decisions Log entry recording the real start timestamp — this is the number `AI/ML Spec §10`'s stopping rule (7-14 days) actually counts from, and it needs a real recorded start, not an assumed one.

---

## Phase 1 completion

This is the last session of Phase 1, per `BUILD_ROADMAP.md`. If Step 4 passes and Step 6-7 are complete, Phase 1 is genuinely done — not because 9 sessions were written, but because the actual safety property this whole phase was building toward has now been physically demonstrated, not just designed.

## Known open items carried into Phase 2/3
🔴 (Genuinely deferred, not a gap) BURN_IN→FULL_OPERATION transition mechanism — Session 34's design question, informed by real burn-in data.
🔴 (Carried) BMP280 real compensation formula — should be closed before burn-in data is used for anything beyond "the sensor responds," ideally before this session's Step 6.
