// ADDED: the real trigger, replacing the "TODO Session 34" placeholders
// left in Sessions 4/7/9. Implemented as: the device receives the
// calibrated model via the SAME OTA mechanism as any retrain (Firmware
// Spec §6) — the mode-change signal rides along in the OTA response
// payload as a new field, resolving the open question Session 9 left
// explicitly unresolved.

// Extends the OTA SWAPPING state's real logic (Session 8's ota_state_machine.c):
if (ota_response.contains("graduate_to_full_operation") && ota_response.graduate_to_full_operation == true) {
    device_identity_set_operating_mode(OPMODE_FULL_OPERATION);
    ESP_LOGW("ota", "Device graduated BURN_IN -> FULL_OPERATION — "
              "actuation capability now genuinely active for the first time.");
}
