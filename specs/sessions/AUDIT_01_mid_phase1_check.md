# AUDIT 01 — Mid-Phase-1 Verification Check
**Risk tier: HIGH-RISK (audits safety-adjacent firmware). Session TYPE: verification (per METHODOLOGY.md §12) — no code delivered, only checks against the real built system. Direct check, not the parallel-subagent technique — that's reserved for the larger Phase 3 final audit per METHODOLOGY.md §10.**
**Branch: `session/audit-01-phase1-midpoint`**
**Attach: Sessions 01-04 (as actually built, not as specified — read the real files), `01_AI_ML_TECHNICAL_SPEC.md`, `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md`, `VERIFY_01-03*.md`**

---

## Why this session exists, restated plainly before running it

AEGIS's own real history (`DEC-013`'s citation): a single end-of-project audit found 11 of 16 backend sessions had a real, previously undetected issue — a config value silently different from spec, a formula implemented with the wrong operator, an entire pipeline stage silently missing — despite complete-code specs and a real verification discipline at build time. **This session exists specifically because "the session's own verification passed" and "the session is actually correct" are different claims.** Sessions 3-4 already have real Unity tests and hardware verification logged — this audit re-checks against the *actual built code*, independently, not by trusting those results were sufficient.

## The discipline for this session (per METHODOLOGY.md's verification philosophy)

**Re-derive, don't just re-read.** For every formula below, independently calculate the expected result by hand (or with a separate small script) and compare against the real code's actual output — do not just read the code and judge whether it "looks right." This is precisely how AEGIS caught its multiplicative-vs-additive bug, which "looked" internally consistent on a read-through.

---

## Checklist

### Config values (the cheapest, most valuable check first)
- [ ] Run the real `test_config_values` Unity test from Session 3 — confirm literal output `3 Tests 0 Failures 0 Ignored`, not "should pass."
- [ ] Independently open the real `config.h` file and manually compare every value against `02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §1-2's tables — do this even though the test above should catch drift, because the test itself could have been written wrong (this is exactly the "who verifies the verifier" question worth asking once here).

### Session 3 — RTOS & acquisition
- [ ] Confirm both I2C devices were genuinely found in real hardware testing — check the actual `HW_VERIFICATION_LOG.md` entry, not the session spec's expected outcome.
- [ ] **Real stress test, not assumed:** saturate Core 1 (e.g., a deliberate busy-loop in the networking or inference stub task) while monitoring audio capture — confirm no glitches/dropouts occur. This is the empirical validation Firmware Spec §1 explicitly flagged as needed ("validate this empirically in Phase 1") — confirm it actually happened, don't skip it because the design looks sound on paper.
- [ ] Confirm the BMP280 open item's actual current state — still placeholder (expected at this point) or silently changed without a Decisions Log entry recording it (would itself be a finding if so).
- [ ] Confirm SW-420's ISR-based ring buffer genuinely triggers on a real physical shake — not just that the code compiles.

### Session 4 — Feature extraction
- [ ] **Hand-recalculate** Welford's algorithm output for a small real sequence pulled from actual logged telemetry (not a synthetic test case) — confirm the real running system's rolling mean/stddev matches your independent calculation.
- [ ] Confirm the vibration FFT's 250-sample-buffer-to-128-point-FFT reconciliation (flagged explicitly in Session 4 as an implementation decision, not silently assumed) is actually implemented as described — read the real `compute_band_energies` function, not the spec's description of it.
- [ ] Confirm `gas_k_temp` and `gas_k_humidity` are genuinely still `0.0` in the real running code (correct pre-burn-in state) — a session could have accidentally hardcoded a non-zero "test" value and forgotten to revert it.
- [ ] Confirm the `DEC-026` self-caught wiring fix (env/gas/current → scoring functions) is genuinely present in the real code, not just in the session spec's markdown — this is exactly the class of gap where the spec could be right and the real implementation could still have silently diverged.

### Cross-session consistency (the class of check that found DEC-017/019 in the specs — now checking the code)
- [ ] Do the real function signatures for `environment_features_update`, `vibration_features_update`, etc. match what Session 4's own later blocks assume when calling them? (The exact AEGIS `DEC-037` failure mode — a later block calling a function using a signature the earlier block doesn't actually have.)
- [ ] Confirm no modality's scoring function was quietly changed to not match its confidence-graded spec value (e.g., ACS712's alpha, confirmed still `0.2`).

## Verification gate for this audit itself
This audit session is complete only when every checklist item above has a real, evidenced answer (a command run, a file actually read, a hand-calculation actually performed) — not a checkmark based on "it was probably fine." Any finding gets logged as a new Decisions Log entry, following the same DEC-017/019/025/026 pattern — including if the finding is "checked, confirmed clean," which is exactly as valuable to record as a real issue.

## If this audit finds something
Follow the Blocker Report protocol (`BLOCKER_REPORT_TEMPLATE.md`) for anything genuinely architecture-significant. For anything safety-critical (touches ADD §9/§11/§12.2), the fix requires your sign-off before being treated as settled — same standard as every other safety-critical change this project has made.
