# SESSION 36 — OTA Round-Trip Test
**Risk tier: HIGH-RISK — Session 34 already exercised OTA's happy path for real; this session's real job is proving the FAILURE paths, which have only ever been unit-tested (Session 8), never physically exercised.**
**Branch: `session/audit-36-ota-roundtrip`**
**Attach: `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §6, Sessions 08, 34 (as actually built), `VERIFY_02` test #5**

---

## Agent Instructions

Four real tests, physically exercised — not re-confirming the happy path (Session 34 already proved that), but specifically the failure and rollback paths that have only existed as unit tests until now. This is exactly `VERIFY_02`'s test #5, run for real.

## Test protocol

### Test 1 — checksum mismatch rejection
Publish a real model file to Supabase Storage, but deliberately corrupt its `checksum_sha256` value in the `model_registry` row (mismatch the real file's actual hash). **Expected:** device downloads, computes the real checksum, detects the mismatch, discards the file, logs a Blocker-Report-worthy event (per Firmware Spec §6's explicit design), and **stays on the prior active model** — confirm via device log that `active_model_version` genuinely didn't change.

### Test 2 — dry-run failure
Publish a deliberately malformed/incompatible model file (e.g., a valid-looking file that isn't a real TFLite model, or one with an incompatible input shape) with a correctly matching checksum. **Expected:** device downloads successfully, checksum passes, but the `DRY_RUN` state's sandboxed load/inference attempt fails — confirm the device discards this file too and stays on the prior model, **without ever having put the broken model at risk of becoming active** (Firmware Spec §6's explicit design: the currently-active model's own interpreter/arena is never touched during dry-run).

### Test 3 — software rollback after a successful swap
Publish a real, valid model that passes checksum and dry-run and genuinely becomes active — then deliberately feed it inputs designed to cause repeated inference failures (e.g., malformed queue data, if reachable safely for testing). **Expected:** after 5 consecutive failures (Firmware Spec §6's proposed N), the device automatically reverts the active-model pointer to the previous known-good model — confirm via log this happened automatically, without any external OTA push triggering the revert.

### Test 4 — hardware-level rollback (the independent, lower layer)
🟡 This tests ESP-IDF's own dual-partition bootloader mechanism, genuinely independent of everything built in this project's own sessions. **Real test:** flash a deliberately broken firmware image (one that fails to boot cleanly — e.g., a build with an intentional early crash). **Expected:** the ESP32-S3's bootloader itself detects the failed boot and reverts to the prior known-good firmware partition automatically — confirm the device recovers on its own without any REZON-specific code involved, proving this really is an independent second layer, not just a second code path that happens to share the same underlying risk.

## Verification gate

All 4 tests logged in `HW_VERIFICATION_LOG.md` with real observed outcomes. **Test 4 specifically needs a clear note distinguishing it as testing ESP-IDF's own mechanism, not REZON's code** — a pass here validates the platform's guarantee, a fail would be a genuine, serious finding about the underlying toolchain, not this project's own logic.

## Known open items
None — pure physical verification of already-built logic.
