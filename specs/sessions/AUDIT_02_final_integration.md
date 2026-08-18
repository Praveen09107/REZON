# AUDIT 02 — Final Integration Audit
**Risk tier: MAXIMUM. Session TYPE: verification, using the parallel-subagent technique reserved specifically for this moment (METHODOLOGY.md §10). The single largest verification pass in the whole project — everything built across Sessions 1-36 checked against everything specified.**
**Branch: `session/audit-37-final-integration`**
**Attach: every technical spec, every session as actually built, `VERIFY_01-04`, `03_ARCHITECTURAL_COMPLIANCE.md`**

---

## Why this is the moment for the subagent technique, and the real caveat that applies

`METHODOLOGY.md` §10 reserves this technique for exactly one moment — this one. But the real AEGIS evidence behind that section is a warning, not just a procedure: three subagents once unanimously agreed on a wrong answer because they shared the same underlying data-access flaw. **This audit's clusters are deliberately built around genuinely different verification methods, not just parallel copies of the same check** — that's what makes their agreement actually mean something.

## Orientation pass (do this first, direct, not via subagents)

Read `STATUS.md` and the full `DECISIONS_LOG.md` — confirm the real, current count of gaps found and closed (as of this writing: `DEC-017, 019, 025, 026, 030, 031, 041, 046, 049, 055, 060, 062`) and carry that list into the cluster briefs below — each cluster specifically re-confirms its own relevant fixes still hold, not just that they were once fixed.

## The four clusters — genuinely different methods, not parallel copies

### Cluster A — Firmware (method: real serial log inspection + physical re-tests)
- Re-verify `config.h` against the signed-off Firmware Spec values (same check as `AUDIT_01`, run again — confirm nothing regressed across Sessions 5-36).
- Confirm `HW_VERIFICATION_LOG.md` entries for Sessions 3, 4, 22, 34, 35, 36 are real, specific, and internally consistent with each other (e.g., Session 35's Test 3 timestamp should be plausible relative to Session 34's completion).
- Re-run one Session 35 test (operator's choice) live, right now, and confirm it still produces the expected result — not trusting the original log alone.

### Cluster B — Backend/Cloud (method: real SQL against the live database, not code review)
- Re-run `SESSION_33`'s `rls-audit.sql` verbatim against the real production project — confirm every table still shows `rls_enabled = true`. A regression here (a later migration accidentally disabling RLS) is a real, serious, and realistic risk to check for, not a formality.
- Re-run `DEC-060`'s rate-limit test (two rapid real requests) — confirm still enforced.
- Confirm `env_score`, `drift_status`, and the device-health fields are genuinely non-null in recent real rows — not just present in the schema.

### Cluster C — Local MLOps (method: run the real scheduled script, inspect real resulting state)
- Run `scheduled_run.py` for real, confirm it completes without error against the real current state (not a fresh/empty test database).
- Confirm the Grafana dashboard (Session 32) reflects genuinely current data when viewed live, not stale/cached.
- Confirm Session 34's calibration output (fitted `k_temp`/`k_humidity`, recalculated fusion weights) is genuinely what the device is currently using — cross-check the device's own reported values against what `calibration.py` computed, not assumed to match.

### Cluster D — Frontend (method: real browser interaction, not a code read)
- Re-run `SESSION_28`'s checklist in full, live, against the current app — confirm nothing regressed across Sessions 29-36's backend-side changes (e.g., confirm the Model & Drift page still correctly shows the post-calibration model from Session 34).

## The cross-cluster check — stronger than any cluster alone (this is the actual independence test)

**Trace one single real event through all four layers, end to end:** take one real actuation event from Session 35's Test 3. Confirm: **(Cluster A)** the firmware log shows the real transition sequence, **(Cluster B)** the exact same event exists in the real `anomaly_events` table with matching timestamp and `contributing_modalities`, **(Cluster C)** it's reflected in the next `telemetry_hourly` aggregate's `sample_count` and `event_count` once computed, **(Cluster D)** it renders correctly in both the Incidents page's narrative and the Trust Audit page's real citation. **If all four independently confirm the same real event consistently, that's genuine cross-method corroboration — not four instances of the same check agreeing because they share a blind spot.**

## Gate

Every cluster's findings get logged as real Decisions Log entries — including "checked, confirmed clean," per this project's own standing practice that a clean result is exactly as valuable to record as a real finding. Anything genuinely new found here follows the same Blocker Report / sign-off discipline as every other finding in this project's history.

## What "done" means for this audit

Phase 3's final gate is not "this document exists" — it's every cluster's real checks passing, the cross-cluster trace holding end-to-end, and the whole Decisions Log read back as one coherent, honest record of a project that found real problems and closed them, not one that claims to have never had any.
